import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para usar pattern matching para instanceof
 */
export class PatternMatchingRule extends AbstractModernizationRule {
  constructor() {
    super(
      'pattern-matching-instanceof',
      'Pattern Matching para instanceof',
      'Substitui verificações instanceof seguidas de cast por pattern matching, eliminando casts redundantes',
      16, // Introduzido como preview no Java 16, estável no Java 17
      [17, 21],
      RuleComplexity.MEDIUM,
      {
        readability: 9,
        performance: 6,
        maintenance: 8
      },
      {
        before: `if (obj instanceof String) {\n  String s = (String) obj;\n  System.out.println(s.length());\n}`,
        after: `if (obj instanceof String s) {\n  System.out.println(s.length());\n}`
      }
    );
  }

  /**
   * Padrão para detectar expressões instanceof seguidas de cast
   */
  private getInstanceofPattern(): RegExp {
    return /if\s*\(\s*(\w+)\s+instanceof\s+(\w+)(?:<[^>]+>)?\s*\)\s*\{(?:\s*(?:final)?\s*(\2)(?:<[^>]+>)?\s+(\w+)\s*=\s*\(\s*\2(?:<[^>]+>)?\s*\)\s*\1\s*;)([^}]*)\}/gs;
  }

  canModernize(document: vscode.TextDocument, text: string): boolean {
    const pattern = this.getInstanceofPattern();
    pattern.lastIndex = 0;
    return pattern.test(text);
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const matches = this.findAllMatches(document, this.getInstanceofPattern());
    return matches.map(m => m.range);
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    const pattern = this.getInstanceofPattern();
    
    return text.replace(pattern, (match, objName, typeName, repeatedType, varName, body) => {
      // Usar o nome da variável de cast como pattern variable
      const patternVar = varName;
      
      // Verificar se varName aparece no corpo
      if (!body.includes(patternVar)) {
        return match;
      }
      
      // Criar a expressão instanceof com pattern matching
      return `if (${objName} instanceof ${typeName} ${patternVar}) {${body}}`;
    });
  }
}