import * as vscode from "vscode";
import { Java8Rules } from "./modernization/versions/java8/java8Rules";
// import { Java9Rules } from './modernization/versions/java9/Java9Rules';
// import { Java11Rules } from './modernization/versions/java11/Java11Rules';
// import { Java15Rules } from './modernization/versions/java15/Java15Rules';
// import { Java17Rules } from './modernization/versions/java17/Java17Rules';
// import { Java21Rules } from './modernization/versions/java21/Java21Rules';
import { PatternAnalyzer } from "./analyzer/patternAnalyzer";
import { RefactoringProvider } from "./refactor/refactoringProvider";
import { ModernizationCodeActionProvider } from "./refactor/codeActions";
import { ModernizationDiagnosticsProvider } from "./features/diagnosticsProvider";
import { ModernizationCodeLensProvider } from "./features/codeLensProvider";
import { ExclusionManager } from "./features/exclusionManager";
import { DashboardView } from "./dashboard/dashboardView";
import { StatisticsProvider } from "./dashboard/statisticsProvider";
import { SidebarProvider } from "./sidebar/sidebarProvider";

/**
 * Ativador da extensão
 */
export class Activator {
  private analyzer: PatternAnalyzer;
  private refactoringProvider: RefactoringProvider;
  private diagnosticsProvider: ModernizationDiagnosticsProvider;
  private codeLensProvider: ModernizationCodeLensProvider;
  private exclusionManager: ExclusionManager;
  private dashboardView: DashboardView;
  private statisticsProvider: StatisticsProvider;
  private sidebarProvider: SidebarProvider;
  private context: vscode.ExtensionContext;
  private diagnosticCollection: vscode.DiagnosticCollection;

  // Armazenar resultados da última análise
  private lastAnalysisResults: any;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Registrar regras de modernização
    this.registerRules();

    // Coleção de diagnósticos para a extensão
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      "legacyJavaModernizer"
    );

    // Criar instâncias dos provedores
    this.analyzer = new PatternAnalyzer();
    this.refactoringProvider = new RefactoringProvider(this.analyzer);
    this.diagnosticsProvider = new ModernizationDiagnosticsProvider(
      this.analyzer
    );
    this.codeLensProvider = new ModernizationCodeLensProvider(this.analyzer);
    this.exclusionManager = new ExclusionManager();
    this.dashboardView = new DashboardView(context.extensionPath);
    this.statisticsProvider = new StatisticsProvider(context);
    this.sidebarProvider = new SidebarProvider(context.extensionUri);
  }

  /**
   * Registra todas as regras de modernização
   */
  private registerRules(): void {
    // Registrar regras para cada versão do Java
    Java8Rules.register();
    // Java9Rules.register();
    // Java11Rules.register();
    // Java15Rules.register();
    // Java17Rules.register();
    // Java21Rules.register();
  }

  /**
   * Ativa a extensão
   */
  public activate(): void {
    console.log('Extensão "Legacy Java Modernizer" ativada');

    // Registrar o provedor de ações de código
    const codeActionProvider = new ModernizationCodeActionProvider(
      this.analyzer,
      this.refactoringProvider,
      this.diagnosticCollection
    );

    // Registrar comandos
    this.registerCommands();

    // Registrar provedores
    this.registerProviders(codeActionProvider);

    // Registrar eventos de editor
    this.registerEditorEvents();

    // Registrar provedor do painel lateral
    this.registerSidebar();

    // Analisar documento ativo na inicialização
    this.analyzeActiveEditor();
  }

  /**
   * Registra comandos da extensão
   */
  private registerCommands(): void {
    const commands = [
      vscode.commands.registerCommand(
        "legacyJavaModernizer.analyzeWorkspace",
        () => {
          this.analyzeWorkspace();
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.showDashboard",
        () => {
          if (this.lastAnalysisResults) {
            this.dashboardView.show(this.lastAnalysisResults);
          } else {
            vscode.window.showInformationMessage(
              "Não há análise disponível. Execute uma análise primeiro."
            );
          }
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.excludeFromModernization",
        (uri: vscode.Uri) => {
          if (uri) {
            this.exclusionManager.excludeFile(uri).then((success) => {
              if (success) {
                vscode.window.showInformationMessage(
                  `Arquivo excluído da modernização.`
                );

                // Atualizar análise
                this.analyzer.updateConfiguration();
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.fsPath === uri.fsPath) {
                  this.diagnosticsProvider.updateDiagnostics(editor.document);
                  this.codeLensProvider.updateCache(editor.document);
                }
              }
            });
          }
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.includeInModernization",
        (uri: vscode.Uri) => {
          if (uri) {
            this.exclusionManager.includeFile(uri).then((success) => {
              if (success) {
                vscode.window.showInformationMessage(
                  `Arquivo incluído na modernização.`
                );

                // Atualizar análise
                this.analyzer.updateConfiguration();
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.fsPath === uri.fsPath) {
                  this.diagnosticsProvider.updateDiagnostics(editor.document);
                  this.codeLensProvider.updateCache(editor.document);
                }
              }
            });
          }
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.applyRefactoring",
        (match) => {
          this.refactoringProvider.applyRefactoring(match).then((success) => {
            if (success) {
              vscode.window.showInformationMessage(
                "Refatoração aplicada com sucesso."
              );
              this.statisticsProvider.updateAppliedStatistics(1);
            }
          });
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.showRefactoringPreview",
        (match) => {
          this.refactoringProvider.showRefactoringPreview(match);
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.excludeOccurrence",
        (match) => {
          this.exclusionManager.excludeOccurrence(match).then((success) => {
            if (success) {
              vscode.window.showInformationMessage(
                "Ocorrência excluída da modernização."
              );

              // Atualizar diagnósticos
              const editor = vscode.window.activeTextEditor;
              if (editor && editor.document.uri.fsPath === match.file.fsPath) {
                this.diagnosticsProvider.updateDiagnostics(editor.document);
                this.codeLensProvider.updateCache(editor.document);
              }
            }
          });
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.modernizeFile",
        (uri: vscode.Uri) => {
          this.modernizeFile(uri);
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.applyAllSuggestions",
        () => {
          this.applyAllSuggestions();
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.refreshSidebar",
        () => {
          // Atualizar a barra lateral com os resultados de análise mais recentes
          if (this.lastAnalysisResults) {
            this.sidebarProvider.updateContent(this.lastAnalysisResults);
          } else {
            this.analyzeWorkspace();
          }
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.showSidebar",
        () => {
          vscode.commands.executeCommand(
            "workbench.view.extension.legacy-java-modernizer"
          );
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.changeTargetVersion",
        () => {
          this.changeTargetVersion();
        }
      ),

      vscode.commands.registerCommand(
        "legacyJavaModernizer.showMetrics",
        () => {
          if (this.lastAnalysisResults) {
            vscode.window.showInformationMessage("Métricas de modernização", {
              detail: `Legibilidade: ${this.lastAnalysisResults.impact.readability.toFixed(
                1
              )}/10
Performance: ${this.lastAnalysisResults.impact.performance.toFixed(1)}/10
Manutenibilidade: ${this.lastAnalysisResults.impact.maintenance.toFixed(1)}/10`,
            });
          } else {
            vscode.window.showInformationMessage(
              "Execute uma análise primeiro para ver as métricas."
            );
          }
        }
      ),
    ];

    // Adicionar ao contexto da extensão
    for (const command of commands) {
      this.context.subscriptions.push(command);
    }
  }

  /**
   * Registra provedores da extensão
   * @param codeActionProvider Provedor de ações de código
   */
  private registerProviders(
    codeActionProvider: ModernizationCodeActionProvider
  ): void {
    const providers = [
      vscode.languages.registerCodeActionsProvider(
        { language: "java" },
        codeActionProvider
      ),

      vscode.languages.registerCodeLensProvider(
        { language: "java" },
        this.codeLensProvider
      ),
    ];

    // Adicionar ao contexto da extensão
    for (const provider of providers) {
      this.context.subscriptions.push(provider);
    }

    // Adicionar coleção de diagnósticos
    this.context.subscriptions.push(this.diagnosticCollection);
  }

  /**
   * Registra eventos de editor
   */
  private registerEditorEvents(): void {
    const editorEvents = [
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === "java") {
          this.diagnosticsProvider.updateDiagnostics(editor.document);
          this.codeLensProvider.updateCache(editor.document);
        }
      }),

      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === "java") {
          this.diagnosticsProvider.updateDiagnostics(event.document);
          this.codeLensProvider.updateCache(event.document);
        }
      }),

      vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === "java") {
          this.diagnosticsProvider.updateDiagnostics(document);
          this.codeLensProvider.updateCache(document);
        }
      }),

      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === "java") {
          this.diagnosticsProvider.updateDiagnostics(document);
          this.codeLensProvider.updateCache(document);
        }
      }),
    ];

    // Adicionar ao contexto da extensão
    for (const event of editorEvents) {
      this.context.subscriptions.push(event);
    }
  }

  /**
   * Registra o provedor de barra lateral
   */
  private registerSidebar(): void {
    const provider = vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      this.sidebarProvider
    );

    this.context.subscriptions.push(provider);
  }

  /**
   * Analisa o editor ativo
   */
  private analyzeActiveEditor(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === "java") {
      this.diagnosticsProvider.updateDiagnostics(activeEditor.document);
      this.codeLensProvider.updateCache(activeEditor.document);
    }
  }

  /**
   * Analisa o workspace completo
   */
  public async analyzeWorkspace(): Promise<void> {
    // Atualizar configurações do analisador
    this.analyzer.updateConfiguration();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Analisando código Java...",
        cancellable: true,
      },
      async (progress, token) => {
        // Iniciar análise
        const results = await this.analyzer.analyzeWorkspace(
          (message, increment) => {
            progress.report({ increment, message });
          }
        );

        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage(
            "Análise cancelada pelo usuário."
          );
          return;
        }

        // Armazenar resultados
        this.lastAnalysisResults = results;

        // Atualizar diagnósticos
        this.diagnosticsProvider.updateAllDiagnostics(results.matches);

        // Limpar cache de CodeLens
        this.codeLensProvider.clearCache();

        // Atualizar estatísticas
        this.statisticsProvider.updateStatistics(results);

        // Atualizar barra lateral
        this.sidebarProvider.updateContent(results);

        // Mostrar resultados
        vscode.window
          .showInformationMessage(
            `Análise concluída. Encontrados ${results.totalPatterns} padrões em ${results.filesWithIssues} arquivos.`,
            "Mostrar Dashboard"
          )
          .then((selection) => {
            if (selection === "Mostrar Dashboard") {
              vscode.commands.executeCommand(
                "legacyJavaModernizer.showDashboard"
              );
            }
          });
      }
    );
  }

  /**
   * Moderniza um arquivo específico
   * @param uri URI do arquivo a ser modernizado
   */
  private async modernizeFile(uri: vscode.Uri): Promise<void> {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Modernizando arquivo...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // Obter correspondências para o arquivo
        const matches = await this.analyzer.analyzeFile(uri);

        if (matches.length === 0) {
          vscode.window.showInformationMessage(
            "Nenhum padrão encontrado para modernização."
          );
          return;
        }

        progress.report({
          increment: 50,
          message: "Aplicando refatorações...",
        });

        // Aplicar refatorações
        const success = await this.refactoringProvider.applyFileRefactorings(
          uri,
          matches
        );

        progress.report({ increment: 50, message: "Concluído" });

        if (success) {
          vscode.window.showInformationMessage(
            `${matches.length} refatorações aplicadas com sucesso.`
          );
          this.statisticsProvider.updateAppliedStatistics(matches.length);

          // Atualizar barra lateral se disponível
          if (this.lastAnalysisResults) {
            this.sidebarProvider.updateContent(this.lastAnalysisResults);
          }
        } else {
          vscode.window.showErrorMessage("Erro ao aplicar refatorações.");
        }
      }
    );
  }

  /**
   * Aplica todas as sugestões de modernização
   */
  private async applyAllSuggestions(): Promise<void> {
    if (
      !this.lastAnalysisResults ||
      !this.lastAnalysisResults.matches ||
      this.lastAnalysisResults.matches.length === 0
    ) {
      vscode.window.showInformationMessage(
        "Nenhuma sugestão disponível para aplicar."
      );
      return;
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Aplicando todas as sugestões...",
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ increment: 0 });

        // Aplicar todas as refatorações
        const count = await this.refactoringProvider.applyAllRefactorings(
          this.lastAnalysisResults.matches,
          (message, increment) => {
            progress.report({ increment, message });
          }
        );

        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage(
            "Operação cancelada pelo usuário."
          );
          return;
        }

        vscode.window.showInformationMessage(
          `${count} refatorações aplicadas com sucesso.`
        );
        this.statisticsProvider.updateAppliedStatistics(count);

        // Atualizar análise após aplicar todas as sugestões
        this.analyzeWorkspace();
      }
    );
  }

  /**
   * Muda a versão alvo do Java
   */
  private async changeTargetVersion(): Promise<void> {
    const config = vscode.workspace.getConfiguration("legacyJavaModernizer");
    const currentVersion = config.get<string>("targetJavaVersion", "11");

    const options = [
      { label: "Java 8", detail: "Versão LTS" },
      { label: "Java 9", detail: "Versão não-LTS" },
      { label: "Java 11", detail: "Versão LTS" },
      { label: "Java 15", detail: "Versão não-LTS" },
      { label: "Java 17", detail: "Versão LTS" },
      { label: "Java 21", detail: "Versão LTS" },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: "Selecione a versão alvo do Java",
      title: "Mudar Versão Alvo",
    });

    if (selected) {
      // Extrair o número da versão
      const version = selected.label.replace("Java ", "");

      // Atualizar configuração
      await config.update(
        "targetJavaVersion",
        version,
        vscode.ConfigurationTarget.Workspace
      );

      // Atualizar configurações do analisador
      this.analyzer.updateConfiguration();

      // Atualizar barra lateral
      this.sidebarProvider.updateTargetVersion(parseInt(version));

      vscode.window.showInformationMessage(
        `Versão alvo do Java alterada para ${selected.label}`
      );

      // Reexecutar análise
      this.analyzeWorkspace();
    }
  }
}
