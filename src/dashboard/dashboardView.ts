import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AnalysisResults } from '../analyzer/patternAnalyzer';

/**
 * Gerencia a visualização do dashboard de modernização
 */
export class DashboardView {
  private panel: vscode.WebviewPanel | undefined;
  private extensionPath: string;
  private lastAnalysisResults: AnalysisResults | undefined;
  
  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }
  
  /**
   * Obtém o caminho para um recurso em disco
   * @param webview Webview
   * @param ...parts Partes do caminho
   */
  private getResourcePath(webview: vscode.Webview, ...parts: string[]): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionPath, ...parts))
    );
  }
  
  /**
   * Obtém o conteúdo HTML para o dashboard
   * @param webview Webview
   * @param data Resultados da análise
   */
  private getWebviewContent(webview: vscode.Webview, data: AnalysisResults): string {
    try {
      // Carregar o conteúdo HTML do dashboard
      const htmlPath = path.join(this.extensionPath, 'src', 'dashboard', 'webview', 'dashboard.html');
      let htmlContent = fs.readFileSync(htmlPath, 'utf8');
      
      // Substituir caminhos de recursos
      const cssPath = this.getResourcePath(webview, 'src', 'dashboard', 'webview', 'dashboard.css');
      const jsPath = this.getResourcePath(webview, 'src', 'dashboard', 'webview', 'dashboard.js');
      
      // Usar CDN para chart.js para evitar problemas de caminhos
      const chartJsPath = "https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js";
      
      htmlContent = htmlContent
        .replace(/{{cssPath}}/g, cssPath.toString())
        .replace(/{{jsPath}}/g, jsPath.toString())
        .replace(/{{chartJsPath}}/g, chartJsPath);
      
      // Converter MapLike para objetos serializáveis
      const serializedData = this.makeDataSerializable(data);
      
      // Injetar dados de análise
      const analysisData = JSON.stringify(serializedData);
      htmlContent = htmlContent.replace('{{analysisData}}', analysisData);
      
      return htmlContent;
    }
    catch (error) {
      console.error("Erro ao gerar conteúdo HTML:", error);
      return `
        <html>
          <body>
            <h1>Erro ao carregar o dashboard</h1>
            <p>Ocorreu um erro ao carregar o conteúdo do dashboard.</p>
            <code>${error}</code>
          </body>
        </html>
      `;
    }
  }
  
  /**
   * Converte os dados de análise para um formato serializável
   * (Converte Map para objetos regulares)
   */
  private makeDataSerializable(data: AnalysisResults): any {
    const result: any = {...data};
    
    // Converter statsByPatternType de Map para objeto
    if (data.statsByPatternType instanceof Map) {
      result.statsByPatternType = Object.fromEntries(data.statsByPatternType);
    }
    
    // Converter statsByFile de Map para objeto
    if (data.statsByFile instanceof Map) {
      result.statsByFile = Object.fromEntries(data.statsByFile);
    }
    
    // Se matches contém objetos complexos, simplificá-los também
    if (Array.isArray(data.matches)) {
      result.matches = data.matches.map(match => ({
        ...match,
        // Simplificar objeto rule
        rule: {
          id: match.rule.id,
          name: match.rule.name,
          description: match.rule.description,
          introducedVersion: match.rule.introducedVersion,
          appliesTo: match.rule.appliesTo,
          complexity: match.rule.complexity,
          impact: match.rule.impact
        },
        // Garantir que o URI do arquivo seja uma string
        file: match.file.toString()
      }));
    }
    
    return result;
  }
  
  /**
   * Mostra o dashboard com os resultados da análise
   * @param data Resultados da análise
   */
  public show(data: AnalysisResults): void {
    this.lastAnalysisResults = data;
    
    // Se o painel já existir, mostrar e atualizar
    if (this.panel) {
      this.panel.reveal();
      this.updateDashboard(data);
      return;
    }
    
    // Criar um novo painel
    this.panel = vscode.window.createWebviewPanel(
      'legacyJavaModernizer.dashboard',
      'Dashboard de Modernização Java',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, 'src', 'dashboard', 'webview')),
          vscode.Uri.file(path.join(this.extensionPath, 'node_modules')),
          vscode.Uri.file(this.extensionPath)
        ]
      }
    );
    
    // Definir o conteúdo HTML
    this.panel.webview.html = this.getWebviewContent(this.panel.webview, data);
    
    // Log para depuração
    console.log('Dashboard created with analysis results:', 
      JSON.stringify(this.makeDataSerializable(data), null, 2).substring(0, 1000) + '...');
    
    // Manipular mensagens do webview
    this.panel.webview.onDidReceiveMessage(
      message => {
        console.log('Message received from dashboard webview:', message);
        
        switch (message.command) {
          case 'applyAllRefactorings':
            console.log('Executing applyAllSuggestions command');
            vscode.commands.executeCommand('legacyJavaModernizer.applyAllSuggestions');
            break;
            
          case 'analyzeWorkspace':
            console.log('Executing analyzeWorkspace command');
            vscode.commands.executeCommand('legacyJavaModernizer.analyzeWorkspace');
            break;
            
          case 'openFile':
            console.log('Opening file:', message.fileUri);
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(message.fileUri));
            break;
            
          case 'modernizeFile':
            console.log('Modernizing file:', message.fileUri);
            vscode.commands.executeCommand('legacyJavaModernizer.modernizeFile', vscode.Uri.parse(message.fileUri));
            break;
            
          case 'log':
            console.log('Dashboard log:', message.data);
            break;
        }
      },
      undefined,
      []
    );
    
    // Limpar quando o painel for fechado
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      []
    );
  }
  
  /**
   * Atualiza o conteúdo do dashboard
   * @param data Novos resultados da análise
   */
  public updateDashboard(data: AnalysisResults): void {
    if (!this.panel) {
      return;
    }
    
    console.log('Updating dashboard with new analysis results');
    this.lastAnalysisResults = data;
    
    // Converter dados para formato serializável
    const serializedData = this.makeDataSerializable(data);
    
    // Enviar dados atualizados para o webview
    this.panel.webview.postMessage({
      command: 'updateData',
      data: serializedData
    });
  }
  
  /**
   * Fecha o dashboard
   */
  public close(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}