import * as vscode from 'vscode';
import * as path from 'path';
import { PatternMatch } from '../analyzer/javaASTParser';

/**
 * Interface de comentário de exclusão
 */
interface ExclusionComment {
  filePath: string;
  line: number;
  ruleId?: string;
}

/**
 * Gerenciador para marcar códigos como excluídos da modernização
 */
export class ExclusionManager {
  private static readonly EXCLUSION_COMMENT = '// @modernize-exclude';
  private static readonly EXCLUSION_COMMENT_WITH_RULE = '// @modernize-exclude';
  
  /**
   * Adiciona um comentário de exclusão para uma linha
   * @param match Correspondência a ser excluída
   */
  public async excludeOccurrence(match: PatternMatch): Promise<boolean> {
    const document = await vscode.workspace.openTextDocument(match.file);
    
    // Criar o comentário de exclusão
    const exclusionComment = `${ExclusionManager.EXCLUSION_COMMENT_WITH_RULE}:${match.rule.id}`;
    
    // Calcular a posição para inserir o comentário
    const line = match.range.start.line;
    const lineText = document.lineAt(line).text;
    const indentation = lineText.match(/^\s*/)?.[0] || '';
    
    // Criar a edição
    const edit = new vscode.WorkspaceEdit();
    edit.insert(
      match.file,
      new vscode.Position(line, 0),
      `${indentation}${exclusionComment}\n`
    );
    
    return await vscode.workspace.applyEdit(edit);
  }
  
  /**
   * Exclui um arquivo inteiro da modernização
   * @param fileUri URI do arquivo a ser excluído
   */
  public async excludeFile(fileUri: vscode.Uri): Promise<boolean> {
    // Adicionar o arquivo à lista de exclusões
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFiles = config.get<string[]>('excludedFiles', []);
    
    const relativePath = vscode.workspace.asRelativePath(fileUri);
    
    if (!excludedFiles.includes(relativePath)) {
      excludedFiles.push(relativePath);
      await config.update('excludedFiles', excludedFiles, vscode.ConfigurationTarget.Workspace);
      return true;
    }
    
    return false;
  }
  
  /**
   * Inclui um arquivo anteriormente excluído
   * @param fileUri URI do arquivo a ser incluído
   */
  public async includeFile(fileUri: vscode.Uri): Promise<boolean> {
    // Remover o arquivo da lista de exclusões
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFiles = config.get<string[]>('excludedFiles', []);
    
    const relativePath = vscode.workspace.asRelativePath(fileUri);
    const index = excludedFiles.indexOf(relativePath);
    
    if (index !== -1) {
      excludedFiles.splice(index, 1);
      await config.update('excludedFiles', excludedFiles, vscode.ConfigurationTarget.Workspace);
      return true;
    }
    
    return false;
  }
  
  /**
   * Exclui uma pasta inteira da modernização
   * @param folderUri URI da pasta a ser excluída
   */
  public async excludeFolder(folderUri: vscode.Uri): Promise<boolean> {
    // Adicionar a pasta à lista de exclusões
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFolders = config.get<string[]>('excludedFolders', []);
    
    const relativePath = vscode.workspace.asRelativePath(folderUri);
    
    if (!excludedFolders.includes(relativePath)) {
      excludedFolders.push(relativePath);
      await config.update('excludedFolders', excludedFolders, vscode.ConfigurationTarget.Workspace);
      return true;
    }
    
    return false;
  }
  
  /**
   * Inclui uma pasta anteriormente excluída
   * @param folderUri URI da pasta a ser incluída
   */
  public async includeFolder(folderUri: vscode.Uri): Promise<boolean> {
    // Remover a pasta da lista de exclusões
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFolders = config.get<string[]>('excludedFolders', []);
    
    const relativePath = vscode.workspace.asRelativePath(folderUri);
    const index = excludedFolders.indexOf(relativePath);
    
    if (index !== -1) {
      excludedFolders.splice(index, 1);
      await config.update('excludedFolders', excludedFolders, vscode.ConfigurationTarget.Workspace);
      return true;
    }
    
    return false;
  }
  
  /**
   * Verifica se uma correspondência está excluída
   * @param match Correspondência a ser verificada
   * @param document Documento
   */
  public isMatchExcluded(match: PatternMatch, document: vscode.TextDocument): boolean {
    // Verificar se o arquivo está excluído
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFiles = config.get<string[]>('excludedFiles', []);
    const excludedFolders = config.get<string[]>('excludedFolders', []);
    
    const relativePath = vscode.workspace.asRelativePath(match.file);
    
    // Verificar exclusão de arquivo
    if (excludedFiles.includes(relativePath)) {
      return true;
    }
    
    // Verificar exclusão de pasta
    for (const folder of excludedFolders) {
      if (relativePath.startsWith(folder)) {
        return true;
      }
    }
    
    // Verificar comentários de exclusão
    const line = match.range.start.line;
    const linesBefore = Math.min(5, line); // Verificar até 5 linhas acima
    
    for (let i = line; i >= line - linesBefore; i--) {
      if (i < 0) {
        break;
      }
      
      const lineText = document.lineAt(i).text;
      
      // Verificar comentário de exclusão geral
      if (lineText.includes(ExclusionManager.EXCLUSION_COMMENT)) {
        // Verificar se o comentário é específico para uma regra
        const ruleMatch = lineText.match(new RegExp(`${ExclusionManager.EXCLUSION_COMMENT_WITH_RULE}:([\\w-]+)`));
        
        if (ruleMatch) {
          // Exclusão específica de regra
          const ruleId = ruleMatch[1];
          return ruleId === match.rule.id;
        } else {
          // Exclusão geral
          return true;
        }
      }
    }
    
    return false;
  }
}