import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para usar novos métodos da API de String do Java 11
 */
export class StringAPIRule extends AbstractModernizationRule {
  constructor() {
    super(
      'string-api-improvements',
      'Melhorias da API de String',
      'Usa novos métodos da API de String como isBlank(), strip(), lines() e repeat()',
      11,
      [11, 15, 17, 21],
      RuleComplexity.SIMPLE,
      {
        readability: 6,
        performance: 5,
        maintenance: 6
      },
      {
        before: `if (str.trim().isEmpty()) {\n  // string em branco\n}`,
        after: `if (str.isBlank()) {\n  // string em branco\n}`
      }
    );
  }

  /**
   * Lista de padrões para modernização de API de String
   */
  private getStringPatterns(): Array<{ pattern: RegExp, replacement: string }> {
    return [
      // trim().isEmpty() -> isBlank()
      {
        pattern: /(\w+)\.trim\(\)\.isEmpty\(\)/g,
        replacement: '$1.isBlank()'
      },
      
      // trim() -> strip()
      {
        pattern: /(\w+)\.trim\(\)/g,
        replacement: '$1.strip()'
      },
      
      // " ".repeat(n) -> " ".repeat(n)
      // Não é uma mudança em si, mas ajudamos o usuário a descobrir este método
      {
        pattern: /new String\(new char\[(\w+)\]\)/g,
        replacement: '" ".repeat($1)'
      },
      
      // Split em linhas
      {
        pattern: /(\w+)\.split\("\\r?\\n"\)/g,
        replacement: '$1.lines().toArray(String[]::new)'
      },
      
      // String.join -> String.join
      // Outra não-mudança, mas ajudamos a descobrir
      {
        pattern: /String\.join\("([^"]+)"(?:,\s*([^)]+))?\)/g,
        replacement: 'String.join("$1"$2 ? ", " + $2 : "")'
      }
    ];
  }

  canModernize(document: vscode.TextDocument, text: string): boolean {
    for (const { pattern } of this.getStringPatterns()) {
      pattern.lastIndex = 0; // Reset regex state
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const ranges: vscode.Range[] = [];
    
    for (const { pattern } of this.getStringPatterns()) {
      const matches = this.findAllMatches(document, pattern);
      ranges.push(...matches.map(m => m.range));
    }
    
    return ranges;
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    
    // Aplicar cada padrão
    let result = text;
    for (const { pattern, replacement } of this.getStringPatterns()) {
      result = result.replace(pattern, replacement);
    }
    
    // Adicionar comentário apenas se houver mudança
    if (result !== text) {
      // Para métodos novos, adicionar um comentário
      if (result.includes('.isBlank()') || 
          result.includes('.strip()') || 
          result.includes('.lines()') || 
          result.includes('.repeat(')) {
        return `// Java 11 String API\n${result}`;
      }
    }
    
    return result;
  }
}