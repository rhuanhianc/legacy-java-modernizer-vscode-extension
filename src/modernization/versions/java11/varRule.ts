import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para usar 'var' para variáveis locais
 */
export class VarRule extends AbstractModernizationRule {
  constructor() {
    super(
      'var-for-local-variables',
      'Var para Variáveis Locais',
      'Substitui declarações de tipo explícitas por var quando o tipo é inferível',
      10, // Introduzido no Java 10, mas incluímos em 11 por ser LTS
      [11, 15, 17, 21],
      RuleComplexity.SIMPLE,
      {
        readability: 7,
        performance: 3,
        maintenance: 6
      },
      {
        before: `ArrayList<String> list = new ArrayList<String>();`,
        after: `var list = new ArrayList<String>();`
      }
    );
  }

  /**
   * Padrão para detectar declarações de variáveis que podem usar var
   * Detecta casos como:
   * - ArrayList<String> list = new ArrayList<String>();
   * - String name = "John";
   * - Integer count = 5;
   */
  private getVarCandidatePattern(): RegExp {
    return /(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*=\s*(new\s+\w+(?:<[^>]+>)?(?:\([^)]*\))|"[^"]*"|'[^']*'|\d+(?:\.\d+)?|true|false)/g;
  }

  canModernize(document: vscode.TextDocument, text: string): boolean {
    const pattern = this.getVarCandidatePattern();
    pattern.lastIndex = 0; // Reset regex state
    return pattern.test(text);
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const matches = this.findAllMatches(document, this.getVarCandidatePattern());
    
    // Filtrar para incluir apenas os casos onde var é apropriado
    const validMatches = matches.filter(m => {
      const [_, type, varName, initialValue] = m.match;
      return this.isVarApplicable(type, initialValue);
    });
    
    return validMatches.map(m => m.range);
  }

  /**
   * Verifica se 'var' é aplicável para esta declaração
   * @param type Tipo declarado
   * @param initialValue Valor inicial
   */
  private isVarApplicable(type: string, initialValue: string): boolean {
    // Casos onde var não é recomendado:
    
    // 1. Quando o tipo é primitivo simples (int, boolean, etc.)
    if (['byte', 'short', 'int', 'long', 'float', 'double', 'boolean', 'char'].includes(type)) {
      // Exceto quando há uma inicialização literal (que pode ser inferida)
      if (initialValue.match(/^(["'].*["']|\d+(?:\.\d+)?|true|false)$/)) {
        return true;
      }
      return false;
    }
    
    // 2. Quando o valor inicial é 'null'
    if (initialValue === 'null') {
      return false;
    }
    
    // 3. Quando o tipo é 'var' (já está usando var)
    if (type === 'var') {
      return false;
    }
    
    // 4. Quando não há inicialização clara
    if (!initialValue) {
      return false;
    }
    
    return true;
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    const pattern = this.getVarCandidatePattern();
    
    return text.replace(pattern, (match, type, varName, initialValue) => {
      // Preservar 'final' se presente
      const finalPrefix = match.startsWith('final') ? 'final ' : '';
      return `${finalPrefix}var ${varName} = ${initialValue}`;
    });
  }
}