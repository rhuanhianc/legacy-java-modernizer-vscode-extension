// src/refactor/codeActions.ts
import * as vscode from 'vscode';

import { RefactoringProvider } from './refactoringProvider';
import { PatternAnalyzer } from '../analyzer/patternAnalyzer';
import { ModernizationDiagnosticsProvider } from '../features/diagnosticsProvider';
import { ImportManager } from '../utils/importManager';

/**
 * Provider for code actions for the extension
 */
export class ModernizationCodeActionProvider implements vscode.CodeActionProvider {
  private analyzer: PatternAnalyzer;
  private refactoringProvider: RefactoringProvider;
  private diagnosticsProvider: ModernizationDiagnosticsProvider;
  
  constructor(
    analyzer: PatternAnalyzer,
    refactoringProvider: RefactoringProvider,
    _diagnosticCollection: vscode.DiagnosticCollection,
    diagnosticsProvider: ModernizationDiagnosticsProvider
  ) {
    this.analyzer = analyzer;
    this.refactoringProvider = refactoringProvider;
    
    // Use the diagnostics provider passed in
    this.diagnosticsProvider = diagnosticsProvider;
  }
  
  /**
   * Provides code actions for the current context
   * @param document Current document
   * @param _range Selected range
   * @param context Code action context
   */
  public async provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): Promise<vscode.CodeAction[] | undefined> {
    // Only provide actions for Java documents
    if (document.languageId !== 'java') {
      return;
    }
    
    const actions: vscode.CodeAction[] = [];
    const processedDiagnostics = new Set<string>(); // Track processed diagnostics to avoid duplicates
    
    // Check if we have modernization-related diagnostics
    const modernizationDiagnostics = context.diagnostics.filter(
      diag => diag.source === 'Legacy Java Modernizer'
    );
    
    console.log(`Found ${modernizationDiagnostics.length} modernization diagnostics`);
    
    for (const diagnostic of modernizationDiagnostics) {
      // Retrieve the match using the diagnosticsProvider
      const match = this.diagnosticsProvider.getMatchFromDiagnostic(diagnostic);
      
      if (match && match.rule) {
        // Use the diagnostic's code as a unique identifier
        const diagnosticId = typeof diagnostic.code === 'string' ? diagnostic.code : '';
        
        // Skip if we've already processed this diagnostic
        if (processedDiagnostics.has(diagnosticId)) {
          continue;
        }
        processedDiagnostics.add(diagnosticId);
        
        console.log(`Creating actions for rule: ${match.rule.id}`);
        
        // Create modernization action
        const modernizeAction = new vscode.CodeAction(
          `Modernize: ${match.rule.name}`,
          vscode.CodeActionKind.QuickFix
        );
        modernizeAction.diagnostics = [diagnostic];
        modernizeAction.isPreferred = true; // Mark as preferred action
        modernizeAction.command = {
          title: 'Apply Refactoring',
          command: 'legacyJavaModernizer.applyRefactoring',
          arguments: [match]
        };
        actions.push(modernizeAction);
        
        // Create action to show preview
        const previewAction = new vscode.CodeAction(
          `Preview change: ${match.rule.name}`,
          vscode.CodeActionKind.QuickFix
        );
        previewAction.diagnostics = [diagnostic];
        previewAction.command = {
          title: 'Show Refactoring Preview',
          command: 'legacyJavaModernizer.showRefactoringPreview',
          arguments: [match]
        };
        actions.push(previewAction);
        
        // Create action to exclude from modernization
        const excludeAction = new vscode.CodeAction(
          `Exclude this occurrence from modernization`,
          vscode.CodeActionKind.QuickFix
        );
        excludeAction.diagnostics = [diagnostic];
        excludeAction.command = {
          title: 'Exclude Occurrence',
          command: 'legacyJavaModernizer.excludeOccurrence',
          arguments: [match]
        };
        actions.push(excludeAction);
      }
    }
    
    // Find unique rule IDs to create "fix all of this type" actions
    const ruleIds = new Set<string>();
    for (const diagnostic of modernizationDiagnostics) {
      const match = this.diagnosticsProvider.getMatchFromDiagnostic(diagnostic);
      if (match && match.rule) {
        ruleIds.add(match.rule.id);
      }
    }
    
    // Add "fix all" actions for each rule type if there are multiple issues
    for (const ruleId of ruleIds) {
      const matchesForRule = modernizationDiagnostics.filter(
        diag => {
          const match = this.diagnosticsProvider.getMatchFromDiagnostic(diag);
          return match?.rule.id === ruleId;
        }
      );
      
      if (matchesForRule.length > 1) {
        // Get rule name from first match
        const firstMatch = this.diagnosticsProvider.getMatchFromDiagnostic(matchesForRule[0]);
        if (firstMatch) {
          const fixRuleTypeAction = new vscode.CodeAction(
            `Fix all ${firstMatch.rule.name} issues in file`,
            vscode.CodeActionKind.QuickFix
          );
          fixRuleTypeAction.diagnostics = matchesForRule;
          fixRuleTypeAction.command = {
            title: 'Fix All Rule Issues',
            command: 'legacyJavaModernizer.fixAllRuleIssues',
            arguments: [ruleId, document.uri]
          };
          actions.push(fixRuleTypeAction);
        }
      }
    }
    
    // Add action to modernize the entire file if there are diagnostics
    if (modernizationDiagnostics.length > 0) {
      const modernizeFileAction = new vscode.CodeAction(
        'Modernize entire file',
        vscode.CodeActionKind.RefactorRewrite
      );
      modernizeFileAction.command = {
        title: 'Modernize File',
        command: 'legacyJavaModernizer.modernizeFile',
        arguments: [document.uri]
      };
      actions.push(modernizeFileAction);
      
      // Add action to show modernization summary for the file
      const summaryAction = new vscode.CodeAction(
        'Show modernization summary',
        vscode.CodeActionKind.RefactorRewrite
      );
      summaryAction.command = {
        title: 'Show Modernization Summary',
        command: 'legacyJavaModernizer.showFileSummary',
        arguments: [document.uri]
      };
      actions.push(summaryAction);
    }
    
    return actions;
  }
  
  /**
   * Updates diagnostics for a specific document
   * @param document Document to update
   */
  public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    await this.diagnosticsProvider.updateDiagnostics(document);
  }
  
  /**
   * Fixes all issues of a specific rule type in a file
   * @param ruleId Rule ID
   * @param fileUri File URI
   */
  public async fixAllRuleIssues(ruleId: string, fileUri: vscode.Uri): Promise<boolean> {
    console.log(`Fixing all issues of rule type ${ruleId} in file ${fileUri.fsPath}`);
    
    try {
      // Analyze the file to get all matches
      const allMatches = await this.analyzer.analyzeFile(fileUri);
      
      // Filter matches for the specific rule
      const ruleMatches = allMatches.filter(match => match.rule.id === ruleId);
      
      if (ruleMatches.length === 0) {
        console.log(`No matches found for rule ${ruleId}`);
        return false;
      }
      
      console.log(`Found ${ruleMatches.length} matches for rule ${ruleId}`);
      
      // Apply refactorings for the matched rule
      const success = await this.refactoringProvider.applyFileRefactorings(fileUri, ruleMatches);
      
      return success;
    } catch (error) {
      console.error(`Error fixing rule issues: ${error}`);
      vscode.window.showErrorMessage(`Error fixing ${ruleId} issues: ${error}`);
      return false;
    }
  }
  
  /**
   * Shows a summary of modernization opportunities in a file
   * @param fileUri File URI
   */
  public async showFileSummary(fileUri: vscode.Uri): Promise<void> {
    console.log(`Showing modernization summary for ${fileUri.fsPath}`);
    
    try {
      // Analyze the file to get all matches
      const matches = await this.analyzer.analyzeFile(fileUri);
      
      if (matches.length === 0) {
        vscode.window.showInformationMessage('No modernization opportunities found in this file.');
        return;
      }
      
      // Group matches by rule
      const matchesByRule = new Map<string, number>();
      
      for (const match of matches) {
        const ruleId = match.rule.id;
        matchesByRule.set(ruleId, (matchesByRule.get(ruleId) || 0) + 1);
      }
      
      // Build summary message
      let summaryMessage = `Found ${matches.length} modernization opportunities:\n\n`;
      
      matchesByRule.forEach((count, ruleId) => {
        const rule = matches.find(m => m.rule.id === ruleId)?.rule;
        if (rule) {
          summaryMessage += `- ${rule.name}: ${count} occurrences\n`;
        }
      });
      
      // Show summary
      vscode.window.showInformationMessage(summaryMessage, 
        ...[
          'Modernize All', 
          'Show in Dashboard'
        ]).then(selection => {
          if (selection === 'Modernize All') {
            vscode.commands.executeCommand('legacyJavaModernizer.modernizeFile', fileUri);
          } else if (selection === 'Show in Dashboard') {
            vscode.commands.executeCommand('legacyJavaModernizer.showDashboard');
          }
        });
    } catch (error) {
      console.error(`Error showing file summary: ${error}`);
      vscode.window.showErrorMessage(`Error showing modernization summary: ${error}`);
    }
  }
}