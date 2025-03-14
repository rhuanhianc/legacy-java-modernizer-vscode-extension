import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para converter loops for-each para operações de Stream API
 */
export class StreamAPIRule extends AbstractModernizationRule {
  constructor() {
    super(
      'for-each-to-stream',
      'For-each para Stream API',
      'Converte loops for-each para operações de Stream API quando apropriado',
      8,
      [8, 9, 11, 15, 17, 21],
      RuleComplexity.MEDIUM,
      {
        readability: 7,
        performance: 6,
        maintenance: 8
      },
      {
        before: `for (String item : items) {\n  if (item.length() > 5) {\n    System.out.println(item.toUpperCase());\n  }\n}`,
        after: `items.stream()\n  .filter(item -> item.length() > 5)\n  .map(String::toUpperCase)\n  .forEach(System.out::println);`
      }
    );
  }

  /**
   * Padrão para detectar loops for-each
   */
  private getForEachPattern(): RegExp {
    return /for\s*\(\s*([\w.<>]+)\s+(\w+)\s*:\s*(\w+(?:\.\w+\(\))?)\s*\)\s*\{([^}]*)\}/gs;
  }

  /**
   * Padrão para detectar filtros dentro de for-each
   */
  private getFilterPattern(itemVar: string): RegExp {
    return new RegExp(`if\\s*\\(\\s*${itemVar}\\s*\\.([^)]+)\\)\\s*\\{([^}]*)\\}`, 'g');
  }

  /**
   * Padrão para detectar transformações dentro de for-each
   */
  private getMapPattern(itemVar: string): RegExp {
    // Por exemplo: String upperCase = item.toUpperCase();
    return new RegExp(`(\\w+)\\s+(\\w+)\\s*=\\s*${itemVar}\\s*\\.([^;]+);`, 'g');
  }

  canModernize(_document: vscode.TextDocument, text: string): boolean {
    const pattern = this.getForEachPattern();
    pattern.lastIndex = 0; // Reset regex state
    return pattern.test(text);
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const matches = this.findAllMatches(document, this.getForEachPattern());
    
    // Filtrar para incluir apenas loops for-each que podem ser convertidos
    const validMatches = matches.filter(m => {
      const text = document.getText(m.range);
      
      // Extrair informações do loop
      const [_, itemType, itemVar, collection, body] = m.match;
      
      // Verificar se o corpo do loop é adequado para conversão
      return this.isBodyConvertible(body, itemVar);
    });
    
    return validMatches.map(m => m.range);
  }

  /**
   * Verifica se o corpo do loop pode ser convertido para Stream API
   * @param body Corpo do loop
   * @param itemVar Nome da variável de item
   */
  private isBodyConvertible(body: string, itemVar: string): boolean {
    // Casos simples que são bons candidatos para conversão:
    
    // 1. System.out.println(item) => forEach(System.out::println)
    if (body.includes(`System.out.println(${itemVar})`) || 
        body.includes(`System.out.println(${itemVar}.`)) {
      return true;
    }
    
    // 2. result.add(item) => collect(Collectors.toList())
    if (body.includes(`.add(${itemVar})`) || 
        body.includes(`.add(${itemVar}.`)) {
      return true;
    }
    
    // 3. if (item.condition()) { ... } => filter(item -> item.condition())
    const filterPattern = this.getFilterPattern(itemVar);
    if (filterPattern.test(body)) {
      return true;
    }
    
    // 4. String upper = item.toUpperCase() => map(String::toUpperCase)
    const mapPattern = this.getMapPattern(itemVar);
    if (mapPattern.test(body)) {
      return true;
    }
    
    // Casos mais complexos podem não ser bons para conversão automática
    return false;
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    const pattern = this.getForEachPattern();
    
    return text.replace(pattern, (_match, itemType, itemVar, collection, body) => {
      // Analisar o corpo do loop para determinar as operações de stream
      const operations: string[] = [];
      
      // Verificar filtros (if statements)
      const filterPattern = this.getFilterPattern(itemVar);
      let filteredBody = body;
      let filterMatch;
      
      while ((filterMatch = filterPattern.exec(body)) !== null) {
        const condition = filterMatch[1].trim();
        // Adicionar operação de filter
        operations.push(`.filter(${itemVar} -> ${itemVar}.${condition})`);
        
        // Remover o if do corpo para processamento adicional
        filteredBody = filteredBody.replace(filterMatch[0], filterMatch[2]);
      }
      
      // Verificar transformações (atribuições)
      const mapPattern = this.getMapPattern(itemVar);
      let mapMatch;
      
      while ((mapMatch = mapPattern.exec(filteredBody)) !== null) {
        const transformation = mapMatch[3].trim();
        // Verificar se podemos usar referência de método
        if (transformation.endsWith(')') && !transformation.includes('(', transformation.indexOf('(')+1)) {
          const methodName = transformation.substring(0, transformation.indexOf('('));
          operations.push(`.map(${itemType}::${methodName})`);
        } else {
          operations.push(`.map(${itemVar} -> ${itemVar}.${transformation})`);
        }
      }
      
      // Verificar forEach (System.out.println)
      if (filteredBody.includes(`System.out.println(${itemVar})`) || 
          filteredBody.includes(`System.out.println(${itemVar}.`)) {
        
        if (filteredBody.includes(`System.out.println(${itemVar})`)) {
          operations.push('.forEach(System.out::println)');
        } else {
          // Extrair a parte após System.out.println(item.
          const printPattern = new RegExp(`System\\.out\\.println\\(${itemVar}\\.(.*?)\\)`, 'g');
          let printMatch;
          
          if ((printMatch = printPattern.exec(filteredBody)) !== null) {
            const printTransformation = printMatch[1].trim();
            if (operations.some(op => op.includes('.map('))) {
              operations.push('.forEach(System.out::println)');
            } else {
              operations.push(`.map(${itemVar} -> ${itemVar}.${printTransformation})`)
                         operations.push('.forEach(System.out::println)');
            }
          } else {
            operations.push('.forEach(System.out::println)');
          }
        }
      }
      
      // Verificar collect (result.add)
      if (filteredBody.includes(`.add(${itemVar})`) || 
          filteredBody.includes(`.add(${itemVar}.`)) {
        
        const collectPattern = new RegExp(`(\\w+)\\.add\\(${itemVar}(?:\\.([^)]*))?\\)`, 'g');
        let collectMatch;
        
        if ((collectMatch = collectPattern.exec(filteredBody)) !== null) {
          const resultVar = collectMatch[1].trim();
          const transformation = collectMatch[2];
          
          if (transformation) {
            if (!operations.some(op => op.includes('.map('))) {
              operations.push(`.map(${itemVar} -> ${itemVar}.${transformation})`);
            }
          }
          
          operations.push('.collect(Collectors.toList())');
          
          // Adicionar uma nota sobre a importação necessária
          return `// Importe: import java.util.stream.Collectors;\n${collection}.stream()\n  ${operations.join('\n  ')}`;
        }
      }
      
      // Se não detectamos uma operação terminal, adicionar collect como padrão
      if (!operations.some(op => op.includes('.forEach(') || op.includes('.collect('))) {
        operations.push('.collect(Collectors.toList())');
        return `// Importe: import java.util.stream.Collectors;\n${collection}.stream()\n  ${operations.join('\n  ')}`;
      }
      
      // Construir a expressão de stream
      return `${collection}.stream()\n  ${operations.join('\n  ')}`;
    });
  }
}