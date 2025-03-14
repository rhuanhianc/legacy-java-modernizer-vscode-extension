import * as vscode from 'vscode';
import { PatternMatch } from '../analyzer/javaASTParser';
import { PatternAnalyzer } from '../analyzer/patternAnalyzer';
import { ImportManager, JavaImport } from '../utils/importManager';

/**
 * Provider for refactorings for Java code modernization
 */
export class RefactoringProvider {
  private analyzer: PatternAnalyzer;
  edit: any;
  
  constructor(analyzer: PatternAnalyzer) {
    this.analyzer = analyzer;
  }
  
  /**
   * Applies a specific refactoring
   * @param match Pattern match to refactor
   */
  public async applyRefactoring(match: PatternMatch): Promise<boolean> {
    console.log(`Applying refactoring: ${match.rule.id}`);
    
    try {
      // Check if the document still exists and is open
      const document = await vscode.workspace.openTextDocument(match.file);
      
      // Check if the match is still valid
      const currentText = document.getText(match.range);
      if (currentText !== match.matchedText) {
        console.log('The text has changed since the analysis, refactoring canceled');
        vscode.window.showWarningMessage(
          'The text has changed since the analysis. Run the analysis again.'
        );
        return false;
      }
      
      // Process the replacement to check if we need to add imports
      const { replacement, imports } = this.processReplacement(match.suggestedReplacement);
      
      // Create a workspace edit
      const edit = new vscode.WorkspaceEdit();
      
      // Add the replacement
      edit.replace(match.file, match.range, replacement);
      
      // Add imports if needed
      if (imports.length > 0) {
        console.log(`Adding ${imports.length} imports for rule ${match.rule.id}`);
        const importEdit = await ImportManager.addImports(document, imports);
        
        // Copy all edits from importEdit to our edit
        if (importEdit && importEdit.size > 0) {
          importEdit.entries().forEach(([uri, edits]) => {
            edits.forEach(edit => {
              if (edit.newText && edit.range) {
                this.edit.insert(uri, edit.range.start, edit.newText);
              }
            });
          });
        }
      }
      
      // Apply the edit
      const success = await vscode.workspace.applyEdit(edit);
      
      // Analyze the document again to update diagnostics
      if (success) {
        // Wait a bit to ensure the editor has updated
        setTimeout(() => {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document.uri.fsPath === match.file.fsPath) {
            this.analyzer.analyzeFile(match.file);
          }
        }, 500);
      }
      
      return success;
    } catch (error) {
      console.error(`Error applying refactoring: ${error}`);
      vscode.window.showErrorMessage(`Error applying refactoring: ${error}`);
      return false;
    }
  }
  
  /**
   * Processes a replacement to extract import instructions and clean the actual code
   * @param replacement The suggested replacement text
   * @returns The clean replacement and any imports to add
   */
  private processReplacement(replacement: string): { replacement: string, imports: JavaImport[] } {
    const imports: JavaImport[] = [];
    let cleanReplacement = replacement;
    
    // Check for import hints in comments
    const importRegex = /\/\/\s*Importe:\s*import\s+([\w.]+)\.(\w+)/g;
    let match;
    
    while ((match = importRegex.exec(replacement)) !== null) {
      const packageName = match[1];
      const className = match[2];
      
      // Add to imports list
      imports.push({
        packageName,
        className
      });
      
      // Remove the import comment from the replacement
      cleanReplacement = cleanReplacement.replace(match[0], '').trim();
    }
    
    return { replacement: cleanReplacement, imports };
  }
  
  /**
   * Applies all refactorings in a file
   * @param fileUri URI of the file
   * @param matches List of matches to apply
   */
  public async applyFileRefactorings(fileUri: vscode.Uri, matches: PatternMatch[]): Promise<boolean> {
    console.log(`Applying ${matches.length} refactorings in file ${fileUri.fsPath}`);
    
    try {
      // Sort matches from back to front to avoid range issues
      const sortedMatches = [...matches].sort((a, b) => 
        b.range.start.line - a.range.start.line || 
        b.range.start.character - a.range.start.character
      );
      
      // Check if the document still exists and is open
      const document = await vscode.workspace.openTextDocument(fileUri);
      
      // Create a workspace edit
      const edit = new vscode.WorkspaceEdit();
      
      // Collect all imports needed
      const allImports: JavaImport[] = [];
      
      // Process all matches
      for (const match of sortedMatches) {
        // Check if the match is still valid
        const currentText = document.getText(match.range);
        if (currentText !== match.matchedText) {
          console.log(`Text changed for match ${match.rule.id}, skipping...`);
          continue;
        }
        
        // Process the replacement
        const { replacement, imports } = this.processReplacement(match.suggestedReplacement);
        
        // Add the replacement
        edit.replace(fileUri, match.range, replacement);
        
        // Collect imports
        allImports.push(...imports);
      }
      
      // Add all needed imports
      if (allImports.length > 0) {
        console.log(`Adding ${allImports.length} imports to file`);
        const importEdit = await ImportManager.addImports(document, allImports);
        
        // Copy all edits from importEdit to our edit
        if (importEdit && importEdit.size > 0) {
          importEdit.entries().forEach(([uri, edits]) => {
            edits.forEach(edit => {
              if (edit.newText && edit.range) {
                this.edit.insert(uri, edit.range.start, edit.newText);
              }
            });
          });
        }
      }
      
      // Apply the edit
      const success = await vscode.workspace.applyEdit(edit);
      
      // Analyze the document again to update diagnostics
      if (success) {
        // Wait a bit to ensure the editor has updated
        setTimeout(() => {
          this.analyzer.analyzeFile(fileUri);
        }, 500);
      }
      
      return success;
    } catch (error) {
      console.error(`Error applying refactorings in file: ${error}`);
      vscode.window.showErrorMessage(`Error applying refactorings: ${error}`);
      return false;
    }
  }
  
  /**
   * Applies all refactorings in all analyzed files
   * @param matches List of matches to apply
   * @param progressCallback Callback to update progress
   */
  public async applyAllRefactorings(
    matches: PatternMatch[],
    progressCallback?: (message: string, increment: number) => void
  ): Promise<number> {
    console.log(`Applying ${matches.length} refactorings in all files`);
    
    try {
      // Group matches by file
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
          progressCallback(`Refactoring ${fileName} (${currentFile}/${totalFiles})`, 1 / totalFiles * 100);
        }
        
        try {
          // Apply refactorings for this file
          const success = await this.applyFileRefactorings(vscode.Uri.parse(fileUri), fileMatches);
          
          if (success) {
            appliedCount += fileMatches.length;
          }
        } catch (error) {
          console.error(`Error refactoring file ${fileUri}: ${error}`);
          // Continue with the next file
        }
      }
      
      return appliedCount;
    } catch (error) {
      console.error(`Error applying all refactorings: ${error}`);
      vscode.window.showErrorMessage(`Error applying all refactorings: ${error}`);
      return 0;
    }
  }
  
  /**
   * Creates a preview of the refactoring
   * @param match Pattern match
   */
  public async showRefactoringPreview(match: PatternMatch): Promise<void> {
    console.log(`Showing preview for refactoring: ${match.rule.id}`);
    
    try {
      // Process the replacement to remove import hints
      const { replacement } = this.processReplacement(match.suggestedReplacement);
      const originalText = match.matchedText;
      
      // Create a comparison document
      const previewUri = vscode.Uri.parse(`untitled:refactoring-preview-${match.rule.id}.diff`);
      
      // Generate diff content
      const diffContent = [
        '--- Original',
        '+++ Refactored',
        '@@ -1,1 +1,1 @@',
        '-' + originalText.replace(/\n/g, '\n-'),
        '+' + replacement.replace(/\n/g, '\n+')
      ].join('\n');
      
      // Create or show the document
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
        // If the document doesn't exist, create a new one
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
      
      // Show the document
      await vscode.window.showTextDocument(previewUri, { 
        preview: true, 
        viewColumn: vscode.ViewColumn.Beside 
      });
    } catch (error) {
      console.error(`Error showing preview: ${error}`);
      vscode.window.showErrorMessage(`Error showing preview: ${error}`);
    }
  }
  
  /**
   * Looks for patterns in the active document and suggests refactorings
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