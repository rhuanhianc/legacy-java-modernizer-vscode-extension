import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AnalysisResults } from '../analyzer/patternAnalyzer';
import { RuleRegistry } from '../modernization/core/ruleRegistry';
import { FolderTreeProvider, FolderTreeItem } from './folderTreeProvider';

/**
 * Provedor de barra lateral para a extensão
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'javaModernizerSidebar';
  
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private _analysisResults?: AnalysisResults;
  private _folderTreeProvider: FolderTreeProvider;
  
  constructor(_extensionUri: vscode.Uri) {
    this._extensionUri = _extensionUri;
    this._folderTreeProvider = new FolderTreeProvider();
    console.log("Initializing sidebar provider");
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
    console.log("Resolving webview view for:", SidebarProvider.viewType);
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
    
    // Carregar a estrutura de pastas
    this.refreshExplorer();
  }
  
  /**
   * Atualiza o conteúdo da barra lateral com novos resultados de análise
   * @param results Resultados da análise
   */
  public updateContent(results: AnalysisResults): void {
    if (this._view) {
      // Store the results first
      this._analysisResults = results;

      // Prepare serializable data
      const serializableResults = this.makeDataSerializable(results);

      // Debug the serialized data
      console.log("Sending analysis data to webview:", JSON.stringify(serializableResults).substring(0, 100) + "...");

      // Post the message to the webview
      this._view.webview.postMessage({
        command: 'updateAnalysis',
        data: serializableResults
      });
    } else {
      console.warn("Cannot update sidebar content - view is not defined");
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
   * Atualiza a estrutura do explorador de pastas
   */
  public async refreshExplorer(): Promise<void> {
    try {
      console.log("Refreshing explorer structure");
      const structure = await this._folderTreeProvider.loadWorkspaceFolders();
      
      if (this._view) {
        this._view.webview.postMessage({
          command: 'updateExplorer',
          structure
        });
      }
    } catch (error) {
      console.error("Error refreshing explorer:", error);
      if (this._view) {
        this._view.webview.postMessage({
          command: 'error',
          message: 'Erro ao carregar estrutura de pastas: ' + error
        });
      }
    }
  }
  
  /**
   * Obtém os caminhos selecionados para análise
   */
  public getSelectedPaths(): string[] {
    return this._folderTreeProvider.getSelectedPaths();
  }
  
  /**
   * Configura o listener de mensagens da webview
   * @param webview Webview
   */
  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        console.log("Received message from webview:", message.command);
        
        switch (message.command) {
          case 'webviewReady':
            console.log("Webview is ready, sending initial data");
            // If we have analysis results, send them immediately
            if (this._analysisResults) {
              this.updateContent(this._analysisResults);
            }
            
            // Also update the target version
            const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
            const targetVersion = config.get<string>('targetJavaVersion', '11');
            this.updateTargetVersion(parseInt(targetVersion));
            
            // Load folder structure
            await this.refreshExplorer();
            break;
            
          case 'analyzeWorkspace':
            vscode.commands.executeCommand('legacyJavaModernizer.analyzeWorkspace');
            break;
            
          case 'analyzeSelected':
            vscode.commands.executeCommand('legacyJavaModernizer.analyzeSelected');
            break;
            
          case 'refreshExplorer':
            await this.refreshExplorer();
            break;
            
          case 'toggleFolder':
            await this.toggleFolder(message.itemId);
            break;
            
          case 'toggleSelection':
            this.toggleSelection(message.itemId);
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
   * Expande ou recolhe uma pasta no explorador
   * @param itemId ID do item
   */
  private async toggleFolder(itemId: string): Promise<void> {
    try {
      // Encontrar o item na árvore
      const item = this.findTreeItemById(this._folderTreeProvider, itemId);
      
      if (item) {
        // Toggle expanded state
        await this._folderTreeProvider.toggleExpanded(item);
        
        // Atualizar a árvore na webview
        if (this._view) {
          this._view.webview.postMessage({
            command: 'updateExplorer',
            structure: this._folderTreeProvider.serializeTree()
          });
        }
      }
    } catch (error) {
      console.error("Error toggling folder:", error);
    }
  }
  
  /**
   * Seleciona ou deseleciona um item no explorador
   * @param itemId ID do item
   */
  private toggleSelection(itemId: string): void {
    try {
      // Encontrar o item na árvore
      const item = this.findTreeItemById(this._folderTreeProvider, itemId);
      
      if (item) {
        // Toggle selected state
        this._folderTreeProvider.toggleSelected(item);
        
        // Atualizar a árvore na webview
        if (this._view) {
          this._view.webview.postMessage({
            command: 'updateExplorer',
            structure: this._folderTreeProvider.serializeTree()
          });
        }
      }
    } catch (error) {
      console.error("Error toggling selection:", error);
    }
  }
  
  /**
   * Encontra um item na árvore pelo ID
   * @param provider Provedor da árvore
   * @param itemId ID do item
   */
  private findTreeItemById(provider: FolderTreeProvider, itemId: string): FolderTreeItem | null {
    const searchInItems = (items: FolderTreeItem[]): FolderTreeItem | null => {
      for (const item of items) {
        if (item.id === itemId) {
          return item;
        }
        
        if (item.children && item.children.length > 0) {
          const found = searchInItems(item.children);
          if (found) {
            return found;
          }
        }
      }
      
      return null;
    };
    
    // Começar a busca na raiz
    return searchInItems(provider.serializeTree());
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
      .replace('{{supportedVersions}}', JSON.stringify(supportedVersions))
      .replace('</section>\n\n        <section class="analysis-section"', 
               '</section>\n\n        <!-- Explorador -->\n        ' + 
               this._getExplorerHtml() + '\n\n        <section class="analysis-section"');
    
    return html;
  }
  
  /**
   * Obtém o HTML para o explorador
   */
  private _getExplorerHtml(): string {
    return `<section class="explorer-section">
    <h2>Explorador de Arquivos</h2>
    <div class="explorer-controls">
        <button class="action-button" id="refreshExplorerBtn">Atualizar Estrutura</button>
    </div>
    <div class="folder-tree" id="folderTree">
        <!-- Preenchido via JavaScript -->
        <div class="no-data-message">
            Carregando estrutura de pastas...
        </div>
    </div>
    <div class="explorer-actions">
        <button class="action-button" id="analyzeSelectedBtn">Analisar Selecionados</button>
    </div>
</section>`;
  }
  
  /**
   * Converte os dados de análise para um formato serializável
   * (converte Map para objetos JSON)
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
        // Simplify rule object
        rule: {
          id: match.rule.id,
          name: match.rule.name,
          description: match.rule.description,
          introducedVersion: match.rule.introducedVersion,
          appliesTo: match.rule.appliesTo,
          complexity: match.rule.complexity,
          impact: match.rule.impact
        },
        // Ensure file URI is a string
        file: match.file.toString()
      }));
    }
    
    return result;
  }
}