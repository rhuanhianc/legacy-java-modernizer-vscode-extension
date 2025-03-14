import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Rule to replace anonymous classes with lambda expressions
 */
export class LambdaRule extends AbstractModernizationRule {
  // Common functional interfaces in Java
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
   * Pattern to detect anonymous classes implementing functional interfaces
   */
  private getAnonymousClassPattern(): RegExp {
    // Build pattern for supported functional interfaces
    const interfacePattern = LambdaRule.FUNCTIONAL_INTERFACES.join('|');
    
    // More robust pattern to detect:
    // 1. new InterfaceName<GenericParams>()
    // 2. { method override with possible @Override }
    // 3. Supports comments and varied formatting
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
      // Remove comments, extra whitespace and line breaks from the body
      const cleanBody = body.trim()
        .replace(/\/\/[^\n]*/g, '') // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .trim();
      
      // Check if the body ends with return or is a simple body
      const hasReturn = cleanBody.match(/return\s+([^;]+);$/);
      
      // Process parameters
      let paramList = parameters
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string | any[]) => p.length > 0)
        .map((p: string) => {
          // Extract just the parameter name (without type)
          const parts = p.split(/\s+/);
          return parts[parts.length - 1];
        })
        .join(", ");
      
      // If no parameters, use ()
      if (paramList.length === 0) {
        paramList = "()";
      } else if (!parameters.includes(",")) {
        // If only one parameter, remove parentheses
        // Except if it has annotations or type
        if (!parameters.includes("@") && parameters.split(/\s+/).length <= 2) {
          paramList = paramList.trim();
        } else {
          paramList = `(${paramList})`;
        }
      } else {
        paramList = `(${paramList})`;
      }
      
      // Build the lambda expression
      let lambdaExpression;
      
      // Count number of statements
      const statementCount = cleanBody.split(';')
        .filter((line: { trim: () => { (): any; new(): any; length: number; }; }) => line.trim().length > 0)
        .length;
      
      if (hasReturn) {
        // If the body has just a return, simplify to an expression
        lambdaExpression = `${paramList} -> ${hasReturn[1]}`;
      } else if (statementCount <= 1) {
        // If the body has only one statement, simplify
        lambdaExpression = `${paramList} -> ${cleanBody.replace(/;$/, '')}`;
      } else {
        // Otherwise, keep the full body with proper indentation
        const formattedBody = cleanBody
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string | any[]) => line.length > 0)
          .join('\n  ');
          
        lambdaExpression = `${paramList} -> {\n  ${formattedBody}\n}`;
      }
      
      // Add semicolon if needed
      if (!lambdaExpression.endsWith(';') && !lambdaExpression.endsWith('}')) {
        lambdaExpression += ';';
      }
      
      // Get the prefix (everything before "new Interface()...")
      const prefixMatch = match.match(/^(.*?)new\s+/);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      
      return `${prefix}${lambdaExpression}`;
    });
  }
}