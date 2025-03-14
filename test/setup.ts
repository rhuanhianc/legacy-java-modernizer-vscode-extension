// test/setup.ts
import * as vscode from 'vscode';

// Mock for VS Code API
jest.mock('vscode', () => {
  // Define valores constantes para evitar referências circulares
  const FileType = {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64
  };
  
  const DiagnosticSeverity = {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  };
  
  const ProgressLocation = {
    Notification: 1,
    SourceControl: 2,
    Window: 3
  };
  
  const EndOfLine = {
    LF: 1,
    CRLF: 2
  };

  return {
    Uri: {
      file: (path: string) => ({ 
        fsPath: path, 
        path: path, 
        scheme: 'file', 
        toString: () => path 
      }),
      parse: (path: string) => ({ 
        fsPath: path, 
        path: path, 
        scheme: 'file', 
        toString: () => path 
      }),
    },
    Range: class {
      constructor(
        public readonly start: vscode.Position,
        public readonly end: vscode.Position
      ) {}
      
      with(change: { start?: vscode.Position; end?: vscode.Position }) {
        return new vscode.Range(
          change.start || this.start,
          change.end || this.end
        );
      }
      
      contains(position: vscode.Position): boolean {
        return (
          (position.line > this.start.line || 
           (position.line === this.start.line && position.character >= this.start.character)) &&
          (position.line < this.end.line || 
           (position.line === this.end.line && position.character <= this.end.character))
        );
      }
      
      translate(lineDelta?: number, characterDelta?: number): vscode.Range {
        const start = new vscode.Position(
          this.start.line + (lineDelta || 0),
          this.start.character + (characterDelta || 0)
        );
        const end = new vscode.Position(
          this.end.line + (lineDelta || 0),
          this.end.character + (characterDelta || 0)
        );
        return new vscode.Range(start, end);
      }
    },
    Position: class {
      constructor(
        public readonly line: number,
        public readonly character: number
      ) {}
      
      with(change: { line?: number; character?: number }) {
        return new vscode.Position(
          change.line !== undefined ? change.line : this.line,
          change.character !== undefined ? change.character : this.character
        );
      }
      
      translate(lineDelta?: number, characterDelta?: number): vscode.Position {
        return new vscode.Position(
          this.line + (lineDelta || 0),
          this.character + (characterDelta || 0)
        );
      }
      
      isAfter(other: vscode.Position): boolean {
        return this.line > other.line || 
          (this.line === other.line && this.character > other.character);
      }
      
      isBefore(other: vscode.Position): boolean {
        return this.line < other.line || 
          (this.line === other.line && this.character < other.character);
      }
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
          const content = uriOrContent.content;
          const lines = content.split('\n');
          
          return Promise.resolve({
            getText: jest.fn((range?: vscode.Range) => {
              if (!range) {
                return content;
              }
              
              // Extract text from the given range
              let result = '';
              for (let i = range.start.line; i <= range.end.line; i++) {
                if (i >= lines.length) {
                  break;
                }
                
                const line = lines[i];
                if (i === range.start.line && i === range.end.line) {
                  // Both start and end on the same line
                  result += line.substring(range.start.character, range.end.character);
                } else if (i === range.start.line) {
                  // Start line
                  result += line.substring(range.start.character);
                  result += '\n';
                } else if (i === range.end.line) {
                  // End line
                  result += line.substring(0, range.end.character);
                } else {
                  // Middle line
                  result += line + '\n';
                }
              }
              
              return result;
            }),
            uri: { 
              fsPath: 'mock-file.java',
              toString: () => 'mock-file.java'
            },
            languageId: 'java',
            lineCount: lines.length,
            lineAt: jest.fn().mockImplementation((line) => {
              const lineContent = line < lines.length ? lines[line] : '';
              return {
                text: lineContent,
                range: new vscode.Range(
                  new vscode.Position(line, 0),
                  new vscode.Position(line, lineContent.length)
                ),
                lineNumber: line,
                isEmptyOrWhitespace: lineContent.trim().length === 0,
                firstNonWhitespaceCharacterIndex: lineContent.search(/\S/),
                rangeIncludingLineBreak: new vscode.Range(
                  new vscode.Position(line, 0),
                  new vscode.Position(line, lineContent.length)
                )
              };
            }),
            positionAt: jest.fn().mockImplementation((offset) => {
              let currentOffset = 0;
              for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const lineLength = lines[lineIndex].length + 1; // +1 for newline
                if (currentOffset + lineLength > offset) {
                  return new vscode.Position(lineIndex, offset - currentOffset);
                }
                currentOffset += lineLength;
              }
              return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
            }),
            offsetAt: jest.fn().mockImplementation((position) => {
              let offset = 0;
              for (let i = 0; i < position.line; i++) {
                offset += lines[i].length + 1; // +1 for newline
              }
              offset += position.character;
              return offset;
            }),
            save: jest.fn().mockResolvedValue(true),
            isClosed: false,
            isDirty: false,
            isUntitled: false,
            version: 1,
            fileName: 'mock-file.java',
            eol: vscode.EndOfLine.LF
          });
        }
        // Mock for file URI
        return Promise.resolve({
          getText: jest.fn().mockReturnValue('// Mock content'),
          uri: uriOrContent,
          languageId: 'java',
          lineCount: 1,
          lineAt: jest.fn().mockReturnValue({ 
            text: '// Mock line',
            range: new vscode.Range(
              new vscode.Position(0, 0),
              new vscode.Position(0, 12)
            ),
            lineNumber: 0,
            isEmptyOrWhitespace: false,
            firstNonWhitespaceCharacterIndex: 0,
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(0, 0),
              new vscode.Position(0, 12)
            )
          }),
          positionAt: jest.fn().mockReturnValue(new vscode.Position(0, 0)),
          offsetAt: jest.fn().mockReturnValue(0),
          save: jest.fn().mockResolvedValue(true),
          isClosed: false,
          isDirty: false,
          isUntitled: false,
          version: 1,
          fileName: 'mock-file.java',
          eol: vscode.EndOfLine.LF
        });
      }),
      applyEdit: jest.fn().mockResolvedValue(true),
      asRelativePath: jest.fn().mockImplementation((uri) => {
        if (typeof uri === 'string') return uri;
        return uri.fsPath || uri.path;
      }),
      fs: {
        readFile: jest.fn().mockResolvedValue(Buffer.from('Mock file content')),
        stat: jest.fn().mockResolvedValue({
          type: FileType.File, // Usando a constante local em vez de vscode.FileType.File
          ctime: Date.now(),
          mtime: Date.now(),
          size: 100
        }),
        writeFile: jest.fn().mockResolvedValue(undefined)
      },
      findFiles: jest.fn().mockResolvedValue([
        { fsPath: 'file1.java', toString: () => 'file1.java' },
        { fsPath: 'file2.java', toString: () => 'file2.java' },
        { fsPath: 'file3.java', toString: () => 'file3.java' }
      ]),
      saveAll: jest.fn().mockResolvedValue(true),
      onDidOpenTextDocument: jest.fn(),
      onDidChangeTextDocument: jest.fn(),
      onDidCloseTextDocument: jest.fn(),
      textDocuments: []
    },
    languages: {
      createDiagnosticCollection: jest.fn().mockReturnValue({
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        forEach: jest.fn()
      }),
      registerCodeActionsProvider: jest.fn(),
      registerCodeLensProvider: jest.fn(),
      registerHoverProvider: jest.fn()
    },
    window: {
      showInformationMessage: jest.fn().mockResolvedValue(null),
      showWarningMessage: jest.fn().mockResolvedValue(null),
      showErrorMessage: jest.fn().mockResolvedValue(null),
      createWebviewPanel: jest.fn().mockReturnValue({
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
          postMessage: jest.fn(),
          asWebviewUri: jest.fn(uri => uri),
          options: {}
        },
        onDidDispose: jest.fn(),
        onDidChangeViewState: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      }),
      withProgress: jest.fn().mockImplementation((options, task) => task({
        report: jest.fn()
      }, { 
        isCancellationRequested: false,
        onCancellationRequested: jest.fn()
      })),
      createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        append: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        name: 'Mock Output Channel'
      }),
      showQuickPick: jest.fn().mockResolvedValue(null),
      registerWebviewViewProvider: jest.fn(),
      showTextDocument: jest.fn(),
      activeTextEditor: null,
      visibleTextEditors: [],
      onDidChangeActiveTextEditor: jest.fn()
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
    DiagnosticSeverity: DiagnosticSeverity, // Usando a constante local
    FileType: FileType, // Usando a constante local
    EndOfLine: EndOfLine, // Usando a constante local
    CodeActionKind: {
      QuickFix: { value: 'quickfix' },
      Refactor: { value: 'refactor' },
      RefactorExtract: { value: 'refactor.extract' },
      RefactorInline: { value: 'refactor.inline' },
      RefactorRewrite: { value: 'refactor.rewrite' },
      Source: { value: 'source' },
      SourceOrganizeImports: { value: 'source.organizeImports' }
    },
    Diagnostic: class {
      constructor(
        public readonly range: vscode.Range,
        public readonly message: string,
        public readonly severity: vscode.DiagnosticSeverity = DiagnosticSeverity.Information
      ) {}
      source: string | undefined;
      code: string | number | { value: string | number; target: vscode.Uri } | undefined;
      tags: vscode.DiagnosticTag[] | undefined;
      relatedInformation: vscode.DiagnosticRelatedInformation[] | undefined;
    },
    DiagnosticRelatedInformation: class {
      constructor(
        public readonly location: vscode.Location,
        public readonly message: string
      ) {}
    },
    Location: class {
      constructor(
        public readonly uri: vscode.Uri,
        public readonly range: vscode.Range
      ) {}
    },
    CodeAction: class {
      constructor(
        public readonly title: string,
        public readonly kind: { value: string }
      ) {}
      command: vscode.Command | undefined;
      diagnostics: vscode.Diagnostic[] | undefined;
      isPreferred: boolean | undefined;
      edit: vscode.WorkspaceEdit | undefined;
    },
    ProgressLocation: ProgressLocation, // Usando a constante local
    EventEmitter: class {
      event = jest.fn();
      fire = jest.fn();
      dispose = jest.fn();
    },
    WorkspaceEdit: class {
      constructor() {
        this._edits = [];
      }
      
      _edits: any[] = [];
      
      replace(uri: vscode.Uri, range: vscode.Range, newText: string) {
        this._edits.push({ type: 'replace', uri, range, newText });
      }
      
      insert(uri: vscode.Uri, position: vscode.Position, newText: string) {
        this._edits.push({ type: 'insert', uri, position, newText });
      }
      
      delete(uri: vscode.Uri, range: vscode.Range) {
        this._edits.push({ type: 'delete', uri, range });
      }
      
      has(uri: vscode.Uri): boolean {
        return this._edits.some(edit => edit.uri === uri);
      }
      
      set(uri: vscode.Uri, edits: vscode.TextEdit[]) {
        this._edits.push({ type: 'set', uri, edits });
      }
      
      size: number = 1;
      
      entries() {
        const entriesByUri = new Map<vscode.Uri, vscode.TextEdit[]>();
        
        for (const edit of this._edits) {
          if (!entriesByUri.has(edit.uri)) {
            entriesByUri.set(edit.uri, []);
          }
          
          let textEdit;
          if (edit.type === 'insert') {
            textEdit = { 
              range: new vscode.Range(edit.position, edit.position),
              newText: edit.newText
            };
          } else if (edit.type === 'replace') {
            textEdit = { 
              range: edit.range,
              newText: edit.newText
            };
          } else if (edit.type === 'delete') {
            textEdit = { 
              range: edit.range,
              newText: ''
            };
          } else {
            continue;
          }
          
          entriesByUri.get(edit.uri)!.push(textEdit);
        }
        
        return entriesByUri.entries();
      }
    },
    TextEdit: class {
      constructor(
        public readonly range: vscode.Range,
        public readonly newText: string
      ) {}
      
      static replace(range: vscode.Range, newText: string): vscode.TextEdit {
        return new vscode.TextEdit(range, newText);
      }
      
      static insert(position: vscode.Position, newText: string): vscode.TextEdit {
        return new vscode.TextEdit(new vscode.Range(position, position), newText);
      }
      
      static delete(range: vscode.Range): vscode.TextEdit {
        return new vscode.TextEdit(range, '');
      }
    },
    RelativePattern: class {
      constructor(
        public readonly base: vscode.WorkspaceFolder | string,
        public readonly pattern: string
      ) {}
      
      toJSON() {
        return {
          base: this.base,
          pattern: this.pattern
        };
      }
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
      }),
      writeFile: jest.fn().mockResolvedValue(undefined),
      access: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      rmdir: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined)
    },
    readFileSync: jest.fn().mockImplementation((path, encoding) => {
      if (path.includes('.java')) {
        return '// Mock Java file content';
      }
      if (path.includes('.html')) {
        return '<html><body>Mock HTML content</body></html>';
      }
      if (path.includes('.css')) {
        return 'body { color: black; }';
      }
      if (path.includes('.js')) {
        return 'console.log("Mock JS content");';
      }
      return 'Mock file content';
    }),
    writeFileSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    rmdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 100,
      mtime: new Date()
    }),
    readdirSync: jest.fn().mockReturnValue(['file1', 'file2', 'file3'])
  };
});

// Mock path module
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: jest.fn((...paths) => paths.join('/')),
    resolve: jest.fn((...paths) => paths.join('/')),
    dirname: jest.fn(path => {
      const parts = path.split('/');
      return parts.slice(0, -1).join('/');
    }),
    basename: jest.fn(path => {
      const parts = path.split('/');
      return parts[parts.length - 1];
    }),
    extname: jest.fn(path => {
      const parts = path.split('.');
      return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
    }),
    parse: jest.fn(path => ({
      root: '',
      dir: path.substring(0, path.lastIndexOf('/')),
      base: path.substring(path.lastIndexOf('/') + 1),
      ext: path.includes('.') ? path.substring(path.lastIndexOf('.')) : '',
      name: path.includes('/') 
        ? path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
        : path.substring(0, path.lastIndexOf('.'))
    }))
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