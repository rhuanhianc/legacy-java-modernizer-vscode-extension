// test/setup.ts
import * as vscode from 'vscode';

// Mock for VS Code API
jest.mock('vscode', () => {
  return {
    Uri: {
      file: (path: string) => ({ fsPath: path, path: path, scheme: 'file', toString: () => path }),
      parse: (path: string) => ({ fsPath: path, path: path, scheme: 'file', toString: () => path }),
    },
    Range: class {
      constructor(
        public readonly start: vscode.Position,
        public readonly end: vscode.Position
      ) {}
    },
    Position: class {
      constructor(
        public readonly line: number,
        public readonly character: number
      ) {}
    },
    workspace: {
      getConfiguration: jest.fn().mockImplementation((section) => {
        if (section === 'legacyJavaModernizer') {
          return {
            get: jest.fn((key, defaultValue) => {
              const config: { [key: string]: any } = {
                'targetJavaVersion': '11',
                'enableAutomaticSuggestions': true,
                'excludedFolders': [],
                'excludedFiles': [],
                'customPatterns': [],
                'showExplorerView': true,
                'showStatisticsView': true,
                'showVersionsView': true,
                'showMonitoringView': true,
                'modernizationMetricsEnabled': true,
                'enabledRules': {}
              };
              return config[key] || defaultValue;
            }),
            update: jest.fn()
          };
        }
        return {};
      }),
      openTextDocument: jest.fn().mockImplementation((uriOrContent) => {
        if (typeof uriOrContent === 'object' && uriOrContent.content) {
          // Mock TextDocument for string content
          return Promise.resolve({
            getText: jest.fn().mockReturnValue(uriOrContent.content),
            uri: { fsPath: 'mock-file.java' },
            languageId: 'java',
            lineAt: jest.fn().mockImplementation((line) => {
              const content = uriOrContent.content;
              const lines = content.split('\n');
              return {
                text: line < lines.length ? lines[line] : ''
              };
            }),
            positionAt: jest.fn().mockImplementation((offset) => {
              const content = uriOrContent.content;
              const text = content.substring(0, offset);
              const lines = text.split('\n');
              const line = lines.length - 1;
              const character = lines[line].length;
              return new vscode.Position(line, character);
            }),
            offsetAt: jest.fn().mockImplementation((position) => {
              const content = uriOrContent.content;
              const lines = content.split('\n');
              let offset = 0;
              for (let i = 0; i < position.line; i++) {
                offset += lines[i].length + 1; // +1 for newline
              }
              offset += position.character;
              return offset;
            })
          });
        }
        // Mock for file URI
        return Promise.resolve({
          getText: jest.fn().mockReturnValue('// Mock content'),
          uri: uriOrContent,
          languageId: 'java',
          lineAt: jest.fn().mockReturnValue({ text: '// Mock line' }),
          positionAt: jest.fn().mockReturnValue(new vscode.Position(0, 0)),
          offsetAt: jest.fn().mockReturnValue(0)
        });
      }),
      applyEdit: jest.fn().mockResolvedValue(true),
      asRelativePath: jest.fn().mockImplementation((uri) => {
        if (typeof uri === 'string') return uri;
        return uri.fsPath || uri.path;
      }),
    },
    languages: {
      createDiagnosticCollection: jest.fn().mockReturnValue({
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
      })
    },
    window: {
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      createWebviewPanel: jest.fn(),
      withProgress: jest.fn().mockImplementation((options, task) => task({}, { isCancellationRequested: false })),
      createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        append: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn(),
        show: jest.fn()
      }),
      showQuickPick: jest.fn(),
      registerWebviewViewProvider: jest.fn(),
    },
    commands: {
      registerCommand: jest.fn(),
      executeCommand: jest.fn()
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
      WorkspaceFolder: 3
    },
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3
    },
    CodeActionKind: {
      QuickFix: { value: 'quickfix' },
      Refactor: { value: 'refactor' },
      RefactorExtract: { value: 'refactor.extract' },
      RefactorInline: { value: 'refactor.inline' },
      RefactorRewrite: { value: 'refactor.rewrite' }
    },
    Diagnostic: class {
      constructor(
        public readonly range: vscode.Range,
        public readonly message: string,
        public readonly severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Information
      ) {}
      source: string | undefined;
      code: string | undefined;
    },
    CodeAction: class {
      constructor(
        public readonly title: string,
        public readonly kind: vscode.CodeActionKind
      ) {}
      command: vscode.Command | undefined;
      diagnostics: vscode.Diagnostic[] | undefined;
      isPreferred: boolean | undefined;
    },
    ProgressLocation: {
      Notification: 1
    },
    EventEmitter: class {
      event = jest.fn();
      fire = jest.fn();
    },
    WorkspaceEdit: class {
      set = jest.fn();
      replace = jest.fn();
      insert = jest.fn();
      delete = jest.fn();
    }
  };
});

// Mock for fs module
jest.mock('fs', () => {
  return {
    promises: {
      readFile: jest.fn().mockImplementation((path, encoding) => {
        // Mock different file content based on path
        if (path.includes('.java')) {
          return Promise.resolve('// Mock Java file content');
        }
        return Promise.resolve('Mock file content');
      })
    },
    readFileSync: jest.fn().mockReturnValue('Mock file content'),
    existsSync: jest.fn().mockReturnValue(true)
  };
});

// Global setup before tests
beforeAll(() => {
  console.log('Test setup complete');
});

// Global teardown after tests
afterAll(() => {
  console.log('All tests completed');
});