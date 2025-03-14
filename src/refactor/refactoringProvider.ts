import * as vscode from 'vscode';
import { PatternMatch } from '../analyzer/javaASTParser';
import { PatternAnalyzer } from '../analyzer/patternAnalyzer';

/**
 * Provedor de refatorações para modernização de código Java
 */
export class RefactoringProvider {
  private analyzer: PatternAnalyzer;
  
  constructor(analyzer: PatternAnalyzer) {
    this.analyzer = analyzer;
  }
  
  /**
   * Aplica uma refatoração específica
   * @param match Correspondência do padrão a ser refatorado
   */
  public async applyRefactoring(match: PatternMatch): Promise<boolean> {
    console.log(`Aplicando refatoração: ${match.rule.id}`);
    
    try {
      // Verificar se o documento ainda existe e está aberto
      const document = await vscode.workspace.openTextDocument(match.file);
      
      // Verificar se a correspondência ainda é válida
      const currentText = document.getText(match.range);
      if (currentText !== match.matchedText) {
        console.log('O texto foi alterado desde a análise, refatoração cancelada');
        vscode.window.showWarningMessage(
          'O texto foi alterado desde a análise. Execute a análise novamente.'
        );
        return false;
      }
      
      // Aplicar a edição
      const edit = new vscode.WorkspaceEdit();
      edit.replace(match.file, match.range, match.suggestedReplacement);
      
      // Realizar a edição
      const success = await vscode.workspace.applyEdit(edit);
      
      // Analisar o documento novamente para atualizar os diagnósticos
      if (success) {
        // Esperar um pouco para garantir que o editor foi atualizado
        setTimeout(() => {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document.uri.fsPath === match.file.fsPath) {
            this.analyzer.analyzeFile(match.file);
          }
        }, 500);
      }
      
      return success;
    } catch (error) {
      console.error(`Erro ao aplicar refatoração: ${error}`);
      vscode.window.showErrorMessage(`Erro ao aplicar refatoração: ${error}`);
      return false;
    }
  }
  
  /**
   * Aplica todas as refatorações em um arquivo
   * @param fileUri URI do arquivo
   * @param matches Lista de correspondências a serem aplicadas
   */
  public async applyFileRefactorings(fileUri: vscode.Uri, matches: PatternMatch[]): Promise<boolean> {
    console.log(`Aplicando ${matches.length} refatorações no arquivo ${fileUri.fsPath}`);
    
    try {
      // Ordenar as correspondências de trás para frente para evitar problemas com alterações de intervalo
      const sortedMatches = [...matches].sort((a, b) => 
        b.range.start.line - a.range.start.line || 
        b.range.start.character - a.range.start.character
      );
      
      const edit = new vscode.WorkspaceEdit();
      
      // Verificar se o documento ainda existe e está aberto
      const document = await vscode.workspace.openTextDocument(fileUri);
      
      for (const match of sortedMatches) {
        // Verificar se a correspondência ainda é válida
        const currentText = document.getText(match.range);
        if (currentText !== match.matchedText) {
          console.log(`Texto alterado para correspondência ${match.rule.id}, pulando...`);
          continue;
        }
        
        edit.replace(fileUri, match.range, match.suggestedReplacement);
      }
      
      // Realizar a edição
      const success = await vscode.workspace.applyEdit(edit);
      
      // Analisar o documento novamente para atualizar os diagnósticos
      if (success) {
        // Esperar um pouco para garantir que o editor foi atualizado
        setTimeout(() => {
          this.analyzer.analyzeFile(fileUri);
        }, 500);
      }
      
      return success;
    } catch (error) {
      console.error(`Erro ao aplicar refatorações no arquivo: ${error}`);
      vscode.window.showErrorMessage(`Erro ao aplicar refatorações: ${error}`);
      return false;
    }
  }
  
  /**
   * Aplica todas as refatorações em todos os arquivos analisados
   * @param matches Lista de correspondências a serem aplicadas
   * @param progressCallback Callback para atualizar o progresso
   */
  public async applyAllRefactorings(
    matches: PatternMatch[],
    progressCallback?: (message: string, increment: number) => void
  ): Promise<number> {
    console.log(`Aplicando ${matches.length} refatorações em todos os arquivos`);
    
    try {
      // Agrupar correspondências por arquivo
      const matchesByFile = new Map<string, PatternMatch[]>();
      
      for (const match of matches) {
        const fileUri = match.file.toString();
        if (!matchesByFile.has(fileUri)) {
          matchesByFile.set(fileUri, []);
        }
        matchesByFile.get(fileUri)!.push(match);
      }
      
      const totalFiles = matchesByFile.size;
      let appliedCount = 0;
      let currentFile = 0;
      
      for (const [fileUri, fileMatches] of matchesByFile.entries()) {
        currentFile++;
        
        if (progressCallback) {
          const fileName = vscode.Uri.parse(fileUri).path.split('/').pop() || 'unknown';
          progressCallback(`Refatorando ${fileName} (${currentFile}/${totalFiles})`, 1 / totalFiles * 100);
        }
        
        try {
          // Aplicar refatorações para este arquivo
          const success = await this.applyFileRefactorings(vscode.Uri.parse(fileUri), fileMatches);
          
          if (success) {
            appliedCount += fileMatches.length;
          }
        } catch (error) {
          console.error(`Erro ao refatorar arquivo ${fileUri}: ${error}`);
          // Continue com o próximo arquivo
        }
      }
      
      return appliedCount;
    } catch (error) {
      console.error(`Erro ao aplicar todas as refatorações: ${error}`);
      vscode.window.showErrorMessage(`Erro ao aplicar todas as refatorações: ${error}`);
      return 0;
    }
  }
  
  /**
   * Cria uma prévia da refatoração
   * @param match Correspondência do padrão
   */
  public async showRefactoringPreview(match: PatternMatch): Promise<void> {
    console.log(`Mostrando prévia para refatoração: ${match.rule.id}`);
    
    try {
      const originalText = match.matchedText;
      const refactoredText = match.suggestedReplacement;
      
      // Criar um documento de comparação
      const previewUri = vscode.Uri.parse(`untitled:refactoring-preview-${match.rule.id}.diff`);
      
      // Gerar conteúdo diff
      const diffContent = [
        '--- Original',
        '+++ Refatoração',
        '@@ -1,1 +1,1 @@',
        '-' + originalText.replace(/\n/g, '\n-'),
        '+' + refactoredText.replace(/\n/g, '\n+')
      ].join('\n');
      
      // Criar ou mostrar o documento
      try {
        const doc = await vscode.workspace.openTextDocument(previewUri);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          previewUri,
          new vscode.Range(0, 0, doc.lineCount, 0),
          diffContent
        );
        
        await vscode.workspace.applyEdit(edit);
      } catch (e) {
        // Se o documento não existir, criar um novo
        const newDoc = await vscode.workspace.openTextDocument({
          content: diffContent,
          language: 'diff'
        });
        
        await vscode.window.showTextDocument(newDoc, { 
          preview: true, 
          viewColumn: vscode.ViewColumn.Beside 
        });
        return;
      }
      
      // Mostrar o documento
      await vscode.window.showTextDocument(previewUri, { 
        preview: true, 
        viewColumn: vscode.ViewColumn.Beside 
      });
    } catch (error) {
      console.error(`Erro ao mostrar prévia: ${error}`);
      vscode.window.showErrorMessage(`Erro ao mostrar prévia: ${error}`);
    }
  }
  
  /**
   * Procura padrões no documento ativo e sugere refatorações
   */
  public async suggestRefactorings(): Promise<PatternMatch[]> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'java') {
      return [];
    }
    
    const fileUri = activeEditor.document.uri;
    return await this.analyzer.analyzeFile(fileUri);
  }
}