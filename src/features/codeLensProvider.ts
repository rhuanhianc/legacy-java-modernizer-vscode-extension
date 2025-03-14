import * as vscode from 'vscode';
import { PatternAnalyzer } from '../analyzer/patternAnalyzer';
import { PatternMatch } from '../analyzer/javaASTParser';

/**
 * Provedor de CodeLens para a extensão
 */
export class ModernizationCodeLensProvider implements vscode.CodeLensProvider {
  private analyzer: PatternAnalyzer;
  private cachedMatches: Map<string, PatternMatch[]> = new Map();
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  
  constructor(analyzer: PatternAnalyzer) {
    this.analyzer = analyzer;
  }
  
  /**
   * Evento disparado quando os CodeLenses mudam
   */
  get onDidChangeCodeLenses(): vscode.Event<void> {
    return this.onDidChangeCodeLensesEmitter.event;
  }
  
  /**
   * Atualiza o cache de correspondências para um documento
   * @param document Documento a ser atualizado
   */
  public async updateCache(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== 'java') {
      return;
    }
    
    const matches = await this.analyzer.analyzeFile(document.uri);
    this.cachedMatches.set(document.uri.toString(), matches);
    this.onDidChangeCodeLensesEmitter.fire();
  }
  
  /**
   * Limpa o cache de correspondências
   */
  public clearCache(): void {
    this.cachedMatches.clear();
    this.onDidChangeCodeLensesEmitter.fire();
  }
  
  /**
   * Fornece CodeLenses para um documento
   * @param document Documento
   * @param token Token de cancelamento
   */
  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (document.languageId !== 'java') {
      return [];
    }
    
    // Verificar se temos correspondências em cache
    let matches = this.cachedMatches.get(document.uri.toString());
    
    // Se não, analisar o documento
    if (!matches) {
      matches = await this.analyzer.analyzeFile(document.uri);
      this.cachedMatches.set(document.uri.toString(), matches);
    }
    
    if (token.isCancellationRequested || !matches || matches.length === 0) {
      return [];
    }
    
    const codeLenses: vscode.CodeLens[] = [];
    
    // Criar um CodeLens para cada correspondência
    for (const match of matches) {
      // CodeLens para aplicar refatoração
      const applyLens = new vscode.CodeLens(match.range, {
        title: `Modernizar: ${match.rule.name}`,
        command: 'legacyJavaModernizer.applyRefactoring',
        arguments: [match]
      });
      
      // CodeLens para mostrar prévia
      const previewLens = new vscode.CodeLens(match.range, {
        title: 'Visualizar mudança',
        command: 'legacyJavaModernizer.showRefactoringPreview',
        arguments: [match]
      });
      
      codeLenses.push(applyLens, previewLens);
    }
    
    // CodeLens para modernizar todo o arquivo
    if (matches.length > 0) {
      const modernizeFileLens = new vscode.CodeLens(
        new vscode.Range(0, 0, 0, 0),
        {
          title: `Modernizar todo o arquivo (${matches.length} ${
            matches.length === 1 ? 'padrão' : 'padrões'
          })`,
          command: 'legacyJavaModernizer.modernizeFile',
          arguments: [document.uri]
        }
      );
      
      codeLenses.push(modernizeFileLens);
    }
    
    return codeLenses;
  }
}