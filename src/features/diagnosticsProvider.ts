import * as vscode from 'vscode';
import { PatternAnalyzer } from '../analyzer/patternAnalyzer';
import { PatternMatch } from '../analyzer/javaASTParser';

// Mapa para armazenar correspondências de diagnósticos
const diagnosticMatchesMap = new Map<string, PatternMatch>();

/**
 * Provedor de diagnósticos para a extensão
 */
export class ModernizationDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private analyzer: PatternAnalyzer;
  private disposables: vscode.Disposable[] = [];
  
  constructor(analyzer: PatternAnalyzer) {
    this.analyzer = analyzer;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('legacyJavaModernizer');
    
    // Registrar eventos para atualizar diagnósticos
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument(this.onDocumentOpen, this),
      vscode.workspace.onDidChangeTextDocument(this.onDocumentChange, this),
      vscode.workspace.onDidCloseTextDocument(this.onDocumentClose, this)
    );
    
    // Analisar documentos já abertos
    vscode.workspace.textDocuments.forEach(this.onDocumentOpen, this);
  }
  
  /**
   * Manipulador para evento de abertura de documento
   * @param document Documento aberto
   */
  private async onDocumentOpen(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== 'java') {
      return;
    }
    
    await this.updateDiagnostics(document);
  }
  
  /**
   * Manipulador para evento de alteração de documento
   * @param event Evento de alteração
   */
  private async onDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
    if (event.document.languageId !== 'java') {
      return;
    }
    
    // Usar um debounce para não analisar a cada tecla pressionada
    this.clearDebounceTimeout();
    this.documentChangeTimeout = setTimeout(() => {
      this.updateDiagnostics(event.document);
    }, 500);
  }
  
  private documentChangeTimeout: NodeJS.Timeout | undefined;
  
  /**
   * Limpa o timeout do debounce
   */
  private clearDebounceTimeout(): void {
    if (this.documentChangeTimeout) {
      clearTimeout(this.documentChangeTimeout);
      this.documentChangeTimeout = undefined;
    }
  }
  
  /**
   * Manipulador para evento de fechamento de documento
   * @param document Documento fechado
   */
  private onDocumentClose(document: vscode.TextDocument): void {
    if (document.languageId !== 'java') {
      return;
    }
    
    // Limpar diagnósticos
    this.diagnosticCollection.delete(document.uri);
  }
  
  /**
   * Gera um ID único para um diagnóstico
   * @param match Correspondência do padrão
   */
  private getDiagnosticId(match: PatternMatch): string {
    const filename = match.file.fsPath;
    const position = `${match.range.start.line}:${match.range.start.character}`;
    const ruleId = match.rule.id;
    return `${filename}#${position}#${ruleId}`;
  }
  
  /**
   * Atualiza os diagnósticos para um documento
   * @param document Documento a ser atualizado
   */
  public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    try {
      console.log(`Atualizando diagnósticos para ${document.uri.fsPath}`);
      
      // Obter correspondências para o documento
      const matches = await this.analyzer.analyzeFile(document.uri);
      console.log(`Encontradas ${matches.length} correspondências`);
      
      // Criar diagnósticos
      const diagnostics = this.createDiagnostics(matches);
      
      // Atualizar a coleção de diagnósticos
      this.diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
      console.error(`Erro ao atualizar diagnósticos: ${error}`);
    }
  }
  
  /**
   * Atualiza os diagnósticos para todos os arquivos
   * @param matches Lista de correspondências
   */
  public updateAllDiagnostics(matches: PatternMatch[]): void {
    try {
      console.log(`Atualizando todos os diagnósticos com ${matches.length} correspondências`);
      
      // Agrupar correspondências por arquivo
      const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();
      
      for (const match of matches) {
        if (!match || !match.file) {
          console.warn("Correspondência inválida encontrada, pulando...");
          continue;
        }
        
        const fileUri = match.file.toString();
        if (!diagnosticsByFile.has(fileUri)) {
          diagnosticsByFile.set(fileUri, []);
        }
        
        // Criar diagnóstico para esta correspondência
        const diagnostic = this.createDiagnosticForMatch(match);
        diagnosticsByFile.get(fileUri)!.push(diagnostic);
      }
      
      // Limpar todos os diagnósticos
      this.diagnosticCollection.clear();
      
      // Definir novos diagnósticos
      for (const [fileUri, diagnostics] of diagnosticsByFile.entries()) {
        try {
          this.diagnosticCollection.set(vscode.Uri.parse(fileUri), diagnostics);
        } catch (error) {
          console.error(`Erro ao definir diagnósticos para ${fileUri}: ${error}`);
        }
      }
      
      console.log(`Diagnósticos atualizados para ${diagnosticsByFile.size} arquivos`);
    } catch (error) {
      console.error(`Erro ao atualizar todos os diagnósticos: ${error}`);
    }
  }
  
  /**
   * Formata um trecho de código Java com indentação adequada
   * @param code Código a ser formatado
   */
  private formatJavaCode(code: string): string {
    // Remover espaços em branco extras no início e fim
    const trimmed = code.trim();
    
    // Identificar o nível de indentação
    const lines = trimmed.split('\n');
    
    // Se houver apenas uma linha, retorna formatado
    if (lines.length <= 1) {
      return trimmed;
    }
    
    // Encontrar o nível de indentação comum
    let minIndent = Number.MAX_VALUE;
    
    for (const line of lines) {
      if (line.trim().length === 0) continue; // Ignorar linhas vazias
      
      const indent = line.search(/\S|$/);
      if (indent < minIndent) {
        minIndent = indent;
      }
    }
    
    // Remover a indentação comum
    const formattedLines = lines.map(line => {
      if (line.trim().length === 0) return '';
      return line.substring(Math.min(minIndent, line.search(/\S|$/)));
    });
    
    return formattedLines.join('\n');
  }
  
  /**
   * Cria um diagnóstico para uma correspondência
   * @param match Correspondência de padrão
   */
  private createDiagnosticForMatch(match: PatternMatch): vscode.Diagnostic {
    // Format code with proper indentation
    const originalCode = this.formatJavaCode(match.matchedText);
    const modernizedCode = this.formatJavaCode(match.suggestedReplacement);
    
    // Create a markdown formatted message with syntax highlighting
    const message = [
      `# ${match.rule.name}`,
      match.rule.description,
      "",
      "## Código Original",
      originalCode,
      "",
      "## Código Modernizado",
      modernizedCode,
    ].join('\n');
    
    const diagnostic = new vscode.Diagnostic(
      match.range,
      message,
      vscode.DiagnosticSeverity.Information
    );
    
    // Set message as markdown
    diagnostic.source = 'Legacy Java Modernizer';
    
    // Gerar um ID único para este diagnóstico
    const diagnosticId = this.getDiagnosticId(match);
    
    // Armazenar a correspondência no mapa global usando o ID como chave
    diagnosticMatchesMap.set(diagnosticId, match);
    
    // Usar o ID como code (compatível com a API)
    diagnostic.code = diagnosticId;
    
    return diagnostic;
  }
  
  /**
   * Cria diagnósticos a partir de correspondências
   * @param matches Lista de correspondências
   */
  private createDiagnostics(matches: PatternMatch[]): vscode.Diagnostic[] {
    return matches.map(match => this.createDiagnosticForMatch(match));
  }
  
  /**
   * Obtém uma correspondência a partir de um diagnóstico
   * @param diagnostic Diagnóstico
   */
  public getMatchFromDiagnostic(diagnostic: vscode.Diagnostic): PatternMatch | undefined {
    if (typeof diagnostic.code === 'string') {
      return diagnosticMatchesMap.get(diagnostic.code);
    }
    return undefined;
  }
  
  /**
   * Limpa os recursos
   */
  public dispose(): void {
    this.clearDebounceTimeout();
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}