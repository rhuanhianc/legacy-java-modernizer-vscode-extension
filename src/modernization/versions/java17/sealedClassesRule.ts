import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para usar classes seladas (sealed classes)
 */
export class SealedClassesRule extends AbstractModernizationRule {
  constructor() {
    super(
      'sealed-classes',
      'Classes Seladas',
      'Converte hierarquias de classes fechadas para usar classes seladas, melhorando a segurança de tipos',
      17,
      [17, 21],
      RuleComplexity.COMPLEX,
      {
        readability: 8,
        performance: 4,
        maintenance: 9
      },
      {
        before: `public abstract class Shape {\n  // métodos comuns\n}\n\npublic class Circle extends Shape {\n  // implementação\n}\n\npublic class Rectangle extends Shape {\n  // implementação\n}`,
        after: `public abstract sealed class Shape permits Circle, Rectangle {\n  // métodos comuns\n}\n\npublic final class Circle extends Shape {\n  // implementação\n}\n\npublic final class Rectangle extends Shape {\n  // implementação\n}`
      }
    );
  }

  /**
   * Padrão para detectar classes abstratas candidatas a classes seladas
   */
  private getAbstractClassPattern(): RegExp {
    return /public\s+abstract\s+class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
  }

  /**
   * Padrão para detectar classes que estendem uma classe específica
   * @param baseClassName Nome da classe base
   */
  private getExtendingClassesPattern(baseClassName: string): RegExp {
    return new RegExp(`public\\s+(?:final\\s+)?class\\s+(\\w+)\\s+extends\\s+${baseClassName}(?:\\s+implements\\s+[^{]+)?\\s*\\{`, 'g');
  }

  canModernize(document: vscode.TextDocument, text: string): boolean {
    const pattern = this.getAbstractClassPattern();
    pattern.lastIndex = 0;
    
    // Primeiro verificar se há classes abstratas
    if (!pattern.test(text)) {
      return false;
    }
    
    // Resetar o padrão
    pattern.lastIndex = 0;
    
    // Verificar se uma das classes abstratas tem subclasses limitadas
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const className = match[1];
      
      // Verificar quantas classes estendem essa classe abstrata
      const extendingPattern = this.getExtendingClassesPattern(className);
      const fullText = document.getText();
      let count = 0;
      let subMatch;
      
      extendingPattern.lastIndex = 0;
      while ((subMatch = extendingPattern.exec(fullText)) !== null) {
        count++;
      }
      
      // Se houver entre 1 e 5 subclasses, é um bom candidato para sealed
      if (count >= 1 && count <= 5) {
        return true;
      }
    }
    
    return false;
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const pattern = this.getAbstractClassPattern();
    const matches = this.findAllMatches(document, pattern);
    
    // Filtrar para incluir apenas classes abstratas adequadas para sealed
    const validMatches = [];
    
    for (const m of matches) {
      const className = m.match[1];
      
      // Verificar quantas classes estendem essa classe abstrata
      const extendingPattern = this.getExtendingClassesPattern(className);
      const fullText = document.getText();
      const subclasses = [];
      let subMatch;
      
      extendingPattern.lastIndex = 0;
      while ((subMatch = extendingPattern.exec(fullText)) !== null) {
        subclasses.push(subMatch[1]);
      }
      
      // Se houver entre 1 e 5 subclasses, é um bom candidato para sealed
      if (subclasses.length >= 1 && subclasses.length <= 5) {
        validMatches.push({
          range: m.range,
          match: m.match,
          subclasses
        });
      }
    }
    
    return validMatches.map(m => m.range);
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    const pattern = this.getAbstractClassPattern();
    
    return text.replace(pattern, (match, className, body) => {
      // Encontrar subclasses
      const extendingPattern = this.getExtendingClassesPattern(className);
      const fullText = document.getText();
      const subclasses = [];
      let subMatch;
      
      extendingPattern.lastIndex = 0;
      while ((subMatch = extendingPattern.exec(fullText)) !== null) {
        subclasses.push(subMatch[1]);
      }
      
      // Se não houver subclasses ou houver muitas, não modificar
      if (subclasses.length === 0 || subclasses.length > 5) {
        return match;
      }
      
      // Criar a classe selada
      return `public abstract sealed class ${className} permits ${subclasses.join(', ')} {${body}}`;
    });
  }
}