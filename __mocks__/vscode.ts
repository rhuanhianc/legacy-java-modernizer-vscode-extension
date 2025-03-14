/**
 * Mock para a API do VS Code
 * Esta é uma versão simplificada que implementa apenas o que é necessário para os testes
 */

// Classes básicas
export class Position {
    constructor(public readonly line: number, public readonly character: number) {}
    
    public with(line = this.line, character = this.character): Position {
      return new Position(line, character);
    }
    
    public translate(lineDelta = 0, characterDelta = 0): Position {
      return new Position(this.line + lineDelta, this.character + characterDelta);
    }
    
    public isBefore(other: Position): boolean {
      return this.line < other.line || (this.line === other.line && this.character < other.character);
    }
    
    public isBeforeOrEqual(other: Position): boolean {
      return this.line < other.line || (this.line === other.line && this.character <= other.character);
    }
    
    public isAfter(other: Position): boolean {
      return this.line > other.line || (this.line === other.line && this.character > other.character);
    }
    
    public isAfterOrEqual(other: Position): boolean {
      return this.line > other.line || (this.line === other.line && this.character >= other.character);
    }
    
    public isEqual(other: Position): boolean {
      return this.line === other.line && this.character === other.character;
    }
    
    public compareTo(other: Position): number {
      if (this.line === other.line) {
        return this.character - other.character;
      }
      return this.line - other.line;
    }
  }
  
  export class Range {
    constructor(
      public readonly start: Position,
      public readonly end: Position
    ) {}
    
    public with(start = this.start, end = this.end): Range {
      return new Range(start, end);
    }
    
    public contains(positionOrRange: Position | Range): boolean {
      if (positionOrRange instanceof Position) {
        return this.start.isBeforeOrEqual(positionOrRange) && this.end.isAfterOrEqual(positionOrRange);
      }
      return this.start.isBeforeOrEqual(positionOrRange.start) && this.end.isAfterOrEqual(positionOrRange.end);
    }
    
    public isEqual(other: Range): boolean {
      return this.start.isEqual(other.start) && this.end.isEqual(other.end);
    }
    
    public intersection(range: Range): Range | undefined {
      const start = this.start.isBefore(range.start) ? range.start : this.start;
      const end = this.end.isAfter(range.end) ? range.end : this.end;
      if (start.isAfter(end)) {
        return undefined;
      }
      return new Range(start, end);
    }
    
    public union(other: Range): Range {
      const start = this.start.isBefore(other.start) ? this.start : other.start;
      const end = this.end.isAfter(other.end) ? this.end : other.end;
      return new Range(start, end);
    }
  }
  
  export class Selection extends Range {
    constructor(
      public readonly anchor: Position,
    ) {
      super(anchor, anchor);
    }
    
    public get isReversed(): boolean {
      return this.anchor.isAfter(this.active);
    }
    
    public get active(): Position {
      return this.end;
    }
    
  }
  
  // Enums
  export enum EndOfLine {
    LF = 1,
    CRLF = 2
  }
  
  export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
  }
  
  export enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Unit = 10,
    Value = 11,
    Enum = 12,
    Keyword = 13,
    Snippet = 14,
    Color = 15,
    File = 16,
    Reference = 17,
    Folder = 18,
    EnumMember = 19,
    Constant = 20,
    Struct = 21,
    Event = 22,
    Operator = 23,
    TypeParameter = 24
  }
  
  export enum CodeActionKind {
    QuickFix = 'quickfix',
    Refactor = 'refactor',
    RefactorExtract = 'refactor.extract',
    RefactorInline = 'refactor.inline',
    RefactorRewrite = 'refactor.rewrite',
    Source = 'source',
    SourceOrganizeImports = 'source.organizeImports'
  }
  
  // Classes de diagnóstico
  export class Diagnostic {
    constructor(
      public readonly range: Range,
      public readonly message: string,
      public readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error
    ) {}
    
    public source?: string;
    public code?: string | number;
    public relatedInformation?: DiagnosticRelatedInformation[];
    public tags?: DiagnosticTag[];
  }
  
  export class DiagnosticRelatedInformation {
    constructor(
      public readonly location: Location,
      public readonly message: string
    ) {}
  }
  
  export enum DiagnosticTag {
    Unnecessary = 1,
    Deprecated = 2
  }
  
  // URI
  export class Uri {
    private constructor(
      public readonly scheme: string,
      public readonly authority: string,
      public readonly path: string,
      public readonly query: string,
      public readonly fragment: string
    ) {}
    
    public static file(path: string): Uri {
      return new Uri('file', '', path, '', '');
    }
    
    public static parse(value: string): Uri {
      // Implementação simplificada de parse
      if (value.startsWith('file:')) {
        return Uri.file(value.substring(5));
      }
      return new Uri('file', '', value, '', '');
    }
    
    public toString(): string {
      return `${this.scheme}://${this.authority}${this.path}${this.query ? '?' + this.query : ''}${this.fragment ? '#' + this.fragment : ''}`;
    }
    
    public with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
      return new Uri(
        change.scheme ?? this.scheme,
        change.authority ?? this.authority,
        change.path ?? this.path,
        change.query ?? this.query,
        change.fragment ?? this.fragment
      );
    }
    
    public get fsPath(): string {
      return this.path;
    }
  }
  
  export class Location {
    constructor(
      public readonly uri: Uri,
      public readonly range: Range
    ) {}
  }
  
  // Classes para ações de código
  export class CodeAction {
    constructor(
      public readonly title: string,
      public readonly kind?: CodeActionKind
    ) {}
    
    public command?: Command;
    public diagnostics?: Diagnostic[];
    public isPreferred?: boolean;
  }
  
  export class Command {
    constructor(
      public readonly title: string,
      public readonly command: string,
      public readonly args?: any[]
    ) {}
  }
  
  // Classes de edição
  export class WorkspaceEdit {
    private edits: Map<string, TextEdit[]> = new Map();
    
    public replace(uri: Uri, range: Range, newText: string): void {
      const edit = new TextEdit(range, newText);
      const key = uri.toString();
      
      if (!this.edits.has(key)) {
        this.edits.set(key, []);
      }
      
      this.edits.get(key)?.push(edit);
    }
    
    public insert(uri: Uri, position: Position, newText: string): void {
      this.replace(uri, new Range(position, position), newText);
    }
    
    public delete(uri: Uri, range: Range): void {
      this.replace(uri, range, '');
    }
    
    public has(uri: Uri): boolean {
      return this.edits.has(uri.toString());
    }
    
    public clear(): void {
      this.edits.clear();
    }
  }
  
  export class TextEdit {
    constructor(
      public readonly range: Range,
      public readonly newText: string
    ) {}
  }
  
  // Mocked Namespaces e API
  export const env = {
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
    language: 'pt-BR'
  };
  
  export const workspace = {
    workspaceFolders: [],
    
    getConfiguration(section?: string): any {
      // Configuração mock que retorna valores default
      return {
        get: <T>(key: string, defaultValue?: T): T => {
          if (section === 'legacyJavaModernizer') {
            if (key === 'targetJavaVersion') return '11' as any;
            if (key === 'excludedFolders') return [] as any;
            if (key === 'excludedFiles') return [] as any;
          }
          return defaultValue as T;
        },
        update: jest.fn().mockResolvedValue(undefined)
      };
    },
    
    async openTextDocument(uriOrPath: Uri | string): Promise<any> {
      // Mock para abrir documento
      const path = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath.fsPath;
      return {
        uri: Uri.file(path),
        fileName: path,
        getText: jest.fn().mockReturnValue('// Mock document content'),
        lineAt: jest.fn().mockImplementation(line => ({
          text: '// Mock line content',
          lineNumber: line,
          range: new Range(new Position(line, 0), new Position(line, 20))
        })),
        positionAt: jest.fn().mockImplementation(offset => new Position(0, offset)),
        offsetAt: jest.fn().mockImplementation(position => position.character),
        lineCount: 10
      };
    },
    
    findFiles: jest.fn().mockResolvedValue([]),
    
    applyEdit: jest.fn().mockResolvedValue(true)
  };
  
  export const window = {
    activeTextEditor: undefined,
    
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    
    showQuickPick: jest.fn().mockResolvedValue(null),
    showInputBox: jest.fn().mockResolvedValue(''),
    
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      append: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }),
    
    withProgress: jest.fn().mockImplementation((options, task) => task({ report: jest.fn() }, { isCancellationRequested: false })),
    
    showTextDocument: jest.fn().mockResolvedValue(undefined),
    
    createWebviewPanel: jest.fn().mockReturnValue({
      webview: {
        html: '',
        options: {},
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn().mockResolvedValue(true),
        dispose: jest.fn()
      },
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn()
    }),
    
    registerWebviewViewProvider: jest.fn().mockReturnValue({ dispose: jest.fn() })
  };
  
  export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn().mockResolvedValue(undefined)
  };
  
  export const languages = {
    createDiagnosticCollection: jest.fn().mockReturnValue({
      name: 'mock-diagnostics',
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn()
    }),
    
    registerCodeActionsProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerCodeLensProvider: jest.fn().mockReturnValue({ dispose: jest.fn() })
  };
  
  // ConfigurationTarget para update
  export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
  }
  
  // Mock dos namespaces restantes
  export const extensions = {
    getExtension: jest.fn().mockReturnValue(undefined),
    all: []
  };
  
  // Export um "contexto de extensão" que pode ser usado nos testes
  export function createMockExtensionContext() {
    return {
      subscriptions: [],
      extensionPath: '/mock/extension/path',
      extensionUri: Uri.file('/mock/extension/path'),
      globalState: {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        keys: jest.fn().mockReturnValue([])
      },
      workspaceState: {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        keys: jest.fn().mockReturnValue([])
      },
      asAbsolutePath: jest.fn().mockImplementation(path => `/mock/extension/path/${path}`)
    };
  }
  
  // Função helper para criar um TextDocument mock
  export function createMockTextDocument(content: string): any {
    const lines = content.split('\n');
    
    return {
      getText: (range?: Range) => {
        if (!range) {
          return content;
        }
        
        let result = '';
        for (let i = range.start.line; i <= range.end.line; i++) {
          const line = lines[i] || '';
          
          if (i === range.start.line && i === range.end.line) {
            result += line.substring(range.start.character, range.end.character);
          } else if (i === range.start.line) {
            result += line.substring(range.start.character) + '\n';
          } else if (i === range.end.line) {
            result += line.substring(0, range.end.character);
          } else {
            result += line + '\n';
          }
        }
        
        return result;
      },
      
      positionAt: (offset: number) => {
        let currentOffset = 0;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const lineLength = lines[lineIndex].length + 1; // +1 para o \n
          if (currentOffset + lineLength > offset) {
            return new Position(lineIndex, offset - currentOffset);
          }
          currentOffset += lineLength;
        }
        return new Position(lines.length - 1, lines[lines.length - 1].length);
      },
      
      offsetAt: (position: Position) => {
        let offset = 0;
        for (let i = 0; i < position.line; i++) {
          offset += (lines[i] || '').length + 1; // +1 para o \n
        }
        return offset + position.character;
      },
      
      lineAt: (lineOrPosition: number | Position) => {
        const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
        const text = lines[line] || '';
        
        return {
          text,
          lineNumber: line,
          range: new Range(new Position(line, 0), new Position(line, text.length)),
          firstNonWhitespaceCharacterIndex: text.search(/\S|$/),
          isEmptyOrWhitespace: text.trim().length === 0
        };
      },
      
      lineCount: lines.length,
      uri: Uri.file('test-file.java'),
      fileName: 'test-file.java',
      languageId: 'java',
      version: 1,
      isDirty: false,
      isUntitled: false
    };
  }