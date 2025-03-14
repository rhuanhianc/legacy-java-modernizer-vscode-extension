import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AnalysisResults } from '../analyzer/patternAnalyzer';
import { RuleRegistry } from '../modernization/core/ruleRegistry';

/**
 * Provedor de barra lateral para a extensão
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'javaModernizerSidebar';
  
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private _analysisResults?: AnalysisResults;
  
  constructor(_extensionUri: vscode.Uri) {
    this._extensionUri = _extensionUri;
  }
  
  /**
   * Resolver a visualização da barra lateral
   * @param webviewView Visualização da webview
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    // Configurar manipuladores de mensagens
    this._setWebviewMessageListener(webviewView.webview);
    
    // Atualizar conteúdo se tivermos resultados
    if (this._analysisResults) {
      this.updateContent(this._analysisResults);
    }
  }
  
  /**
   * Atualiza o conteúdo da barra lateral com novos resultados de análise
   * @param results Resultados da análise
   */
  public updateContent(results: AnalysisResults): void {
    if (this._view) {
      this._analysisResults = results;
      this._view.webview.postMessage({
        command: 'updateAnalysis',
        data: results
      });
    }
  }
  
  /**
   * Atualiza a versão alvo do Java na barra lateral
   * @param version Versão alvo do Java
   */
  public updateTargetVersion(version: number): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateTargetVersion',
        version
      });
    }
  }
  
  /**
   * Configura o listener de mensagens da webview
   * @param webview Webview
   */
  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        switch (message.command) {
          case 'analyzeWorkspace':
            vscode.commands.executeCommand('legacyJavaModernizer.analyzeWorkspace');
            break;
            
          case 'showDashboard':
            vscode.commands.executeCommand('legacyJavaModernizer.showDashboard');
            break;
            
          case 'changeTargetVersion':
            vscode.commands.executeCommand('legacyJavaModernizer.changeTargetVersion');
            break;
            
          case 'openFile':
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(message.fileUri));
            break;
            
          case 'modernizeFile':
            vscode.commands.executeCommand('legacyJavaModernizer.modernizeFile', vscode.Uri.parse(message.fileUri));
            break;
            
          case 'applyAllSuggestions':
            vscode.commands.executeCommand('legacyJavaModernizer.applyAllSuggestions');
            break;
            
          case 'showMetrics':
            vscode.commands.executeCommand('legacyJavaModernizer.showMetrics');
            break;
        }
      },
      undefined,
      []
    );
  }
  
  /**
   * Obtém o caminho para um recurso local
   * @param webview Webview
   * @param ...pathSegments Segmentos do caminho
   */
  private _getUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...pathSegments));
  }
  
  /**
   * Obtém o HTML para a visualização da webview
   * @param webview Webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Carregar o HTML da barra lateral
    const filePath = vscode.Uri.joinPath(this._extensionUri, 'src', 'sidebar', 'webview', 'sidebar.html');
    let html = fs.readFileSync(filePath.fsPath, 'utf8');
    
    // Substituir caminhos de recursos
    const cssPath = this._getUri(webview, 'src', 'sidebar', 'webview', 'sidebar.css');
    const jsPath = this._getUri(webview, 'src', 'sidebar', 'webview', 'sidebar.js');
    
    html = html
      .replace(/{{cssPath}}/g, cssPath.toString())
      .replace(/{{jsPath}}/g, jsPath.toString());
    
    // Adicionar informações do estado atual
    
    // Versão alvo atual
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const targetVersion = config.get<string>('targetJavaVersion', '11');
    
    // Versões suportadas
    const registry = RuleRegistry.getInstance();
    const supportedVersions = registry.getSupportedVersions();
    
    html = html
      .replace('{{targetVersion}}', targetVersion)
      .replace('{{supportedVersions}}', JSON.stringify(supportedVersions));
    
    return html;
  }
}