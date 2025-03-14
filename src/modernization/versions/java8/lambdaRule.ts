import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para substituir classes anônimas por expressões lambda
 */
export class LambdaRule extends AbstractModernizationRule {
  // Interfaces funcionais comuns do Java
  private static FUNCTIONAL_INTERFACES = [
    'Runnable',
    'Callable',
    'Comparator',
    'Consumer',
    'BiConsumer',
    'Function',
    'BiFunction',
    'Predicate',
    'BiPredicate',
    'Supplier'
  ];

  constructor() {
    super(
      'lambda-for-anonymous-class',
      'Lambdas para Classes Anônimas',
      'Substitui implementações de interfaces funcionais com classes anônimas por expressões lambda',
      8,
      [8, 9, 11, 15, 17, 21],
      RuleComplexity.MEDIUM,
      {
        readability: 8,
        performance: 5,
        maintenance: 7
      },
      {
        before: `Runnable r = new Runnable() {\n  @Override\n  public void run() {\n    System.out.println("Hello");\n  }\n};`,
        after: `Runnable r = () -> System.out.println("Hello");`
      }
    );
  }

  /**
   * Padrão para detectar classes anônimas que implementam interfaces funcionais
   */
  private getAnonymousClassPattern(): RegExp {
    // Construir pattern para interfaces funcionais suportadas
    const interfacePattern = LambdaRule.FUNCTIONAL_INTERFACES.join('|');
    
    // Padrão mais robusto para detectar:
    // 1. new InterfaceName<GenericParams>()
    // 2. { sobrescrita de método com possível @Override }
    // 3. Suporta comentários e formatação variada
    return new RegExp(
      // Interface name with optional generic parameters
      `new\\s+(${interfacePattern})(?:<[^>]*>)?\\s*\\(\\)\\s*\\{\\s*` +
      // Optional @Override annotation and method visibility
      `(?:\\s*(?:\\/\\/[^\\n]*\\n|\\/\\*[\\s\\S]*?\\*\\/)?\\s*)?` +
      `(?:@Override\\s*)?` +
      `(?:public\\s+)?` +
      // Return type and method name
      `(?:\\s*(?:\\/\\/[^\\n]*\\n|\\/\\*[\\s\\S]*?\\*\\/)?\\s*)?` +
      `\\w+\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*\\{` +
      // Method body
      `([\\s\\S]*?)` +
      // End of method and anonymous class
      `\\}\\s*\\}`,
      'g'
    );
  }

  canModernize(_document: vscode.TextDocument, text: string): boolean {
    const pattern = this.getAnonymousClassPattern();
    pattern.lastIndex = 0; // Reset regex state
    return pattern.test(text);
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const matches = this.findAllMatches(document, this.getAnonymousClassPattern());
    return matches.map(m => m.range);
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    const pattern = this.getAnonymousClassPattern();
    
    return text.replace(pattern, (match, _interfaceName, _methodName, parameters, body) => {
      // Remover comentários, espaços em branco extras e quebras de linha do corpo
      const cleanBody = body.trim()
        .replace(/\/\/[^\n]*/g, '') // Remover comentários de linha
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remover comentários de bloco
        .trim();
      
      // Verificar se o corpo termina com return ou se é um corpo simples
      const hasReturn = cleanBody.match(/return\s+([^;]+);$/);
      
      // Processar parâmetros
      let paramList = parameters
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string | any[]) => p.length > 0)
        .map((p: string) => {
          // Extrair apenas o nome do parâmetro (sem tipo)
          const parts = p.split(/\s+/);
          return parts[parts.length - 1];
        })
        .join(", ");
      
      // Se não tiver parâmetros, usar ()
      if (paramList.length === 0) {
        paramList = "()";
      } else if (!parameters.includes(",")) {
        // Se tiver apenas um parâmetro, remover parênteses
        // Exceto se tiver anotações ou tipo
        if (!parameters.includes("@") && parameters.split(/\s+/).length <= 2) {
          paramList = paramList.trim();
        } else {
          paramList = `(${paramList})`;
        }
      } else {
        paramList = `(${paramList})`;
      }
      
      // Construir a expressão lambda
      let lambdaExpression;
      
      if (hasReturn) {
        // Se o corpo tiver apenas um return, simplificar para uma expressão
        lambdaExpression = `${paramList} -> ${hasReturn[1]}`;
      } else if (cleanBody.split(';').filter((line: { trim: () => { (): any; new(): any; length: number; }; }) => line.trim().length > 0).length === 1) {
        // Se o corpo tiver apenas uma instrução, simplificar
        lambdaExpression = `${paramList} -> ${cleanBody.replace(/;$/, '')}`;
      } else {
        // Caso contrário, manter o corpo completo
        lambdaExpression = `${paramList} -> {\n  ${cleanBody}\n}`;
      }
      
      // Obter o prefixo (tudo antes de "new Interface()...")
      const prefixMatch = match.match(/^(.*?)new\s+/);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      
      return `${prefix}${lambdaExpression}`;
    });
  }
}