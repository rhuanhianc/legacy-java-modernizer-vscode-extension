import * as vscode from 'vscode';

import { RefactoringProvider } from './refactoringProvider';
import { PatternAnalyzer } from '../analyzer/patternAnalyzer';
import { ModernizationDiagnosticsProvider } from '../features/diagnosticsProvider';

/**
 * Provedor de ações de código para a extensão
 */
export class ModernizationCodeActionProvider implements vscode.CodeActionProvider {
  private analyzer: PatternAnalyzer;
  private refactoringProvider: RefactoringProvider;
  private diagnosticsProvider: ModernizationDiagnosticsProvider;
  
  constructor(
    analyzer: PatternAnalyzer,
    refactoringProvider: RefactoringProvider,
    _diagnosticCollection: vscode.DiagnosticCollection
  ) {
    this.analyzer = analyzer;
    this.refactoringProvider = refactoringProvider;
    
    // Inicializar o provedor de diagnósticos
    this.diagnosticsProvider = new ModernizationDiagnosticsProvider(analyzer);
  }
  
  /**
   * Fornece ações de código para o contexto atual
   * @param document Documento atual
   * @param _range Intervalo selecionado
   * @param context Contexto da ação de código
   */
  public async provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): Promise<vscode.CodeAction[] | undefined> {
    // Só fornecer ações para documentos Java
    if (document.languageId !== 'java') {
      return;
    }
    
    const actions: vscode.CodeAction[] = [];
    
    // Verificar se temos diagnósticos relacionados à modernização
    const modernizationDiagnostics = context.diagnostics.filter(
      diag => diag.source === 'Legacy Java Modernizer'
    );
    
    for (const diagnostic of modernizationDiagnostics) {
      // Recuperar a correspondência usando o diagnosticsProvider
      const match = this.diagnosticsProvider.getMatchFromDiagnostic(diagnostic);
      
      if (match && match.rule) {
        // Criar ação de modernização
        const modernizeAction = new vscode.CodeAction(
          `Modernizar: ${match.rule.name}`,
          vscode.CodeActionKind.QuickFix
        );
        modernizeAction.diagnostics = [diagnostic];
        modernizeAction.isPreferred = true; // Marcar como ação preferida
        modernizeAction.command = {
          title: 'Aplicar Refatoração',
          command: 'legacyJavaModernizer.applyRefactoring',
          arguments: [match]
        };
        actions.push(modernizeAction);
        
        // Criar ação para mostrar prévia
        const previewAction = new vscode.CodeAction(
          `Visualizar mudança: ${match.rule.name}`,
          vscode.CodeActionKind.QuickFix
        );
        previewAction.diagnostics = [diagnostic];
        previewAction.command = {
          title: 'Mostrar Prévia da Refatoração',
          command: 'legacyJavaModernizer.showRefactoringPreview',
          arguments: [match]
        };
        actions.push(previewAction);
        
        // Criar ação para excluir da modernização
        const excludeAction = new vscode.CodeAction(
          `Excluir esta ocorrência da modernização`,
          vscode.CodeActionKind.QuickFix
        );
        excludeAction.diagnostics = [diagnostic];
        excludeAction.command = {
          title: 'Excluir Ocorrência',
          command: 'legacyJavaModernizer.excludeOccurrence',
          arguments: [match]
        };
        actions.push(excludeAction);
      }
    }
    
    // Adicionar ação para modernizar todo o arquivo se tiver diagnósticos
    if (modernizationDiagnostics.length > 0) {
      const modernizeFileAction = new vscode.CodeAction(
        'Modernizar todo o arquivo',
        vscode.CodeActionKind.RefactorRewrite
      );
      modernizeFileAction.command = {
        title: 'Modernizar Arquivo',
        command: 'legacyJavaModernizer.modernizeFile',
        arguments: [document.uri]
      };
      actions.push(modernizeFileAction);
    }
    
    return actions;
  }
  
  /**
   * Atualiza os diagnósticos para um documento específico
   * @param document Documento a ser atualizado
   */
  public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    await this.diagnosticsProvider.updateDiagnostics(document);
  }
}