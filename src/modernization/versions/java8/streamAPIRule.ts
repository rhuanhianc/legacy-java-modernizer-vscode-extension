import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Rule to convert for-each loops to Stream API operations
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
   * Pattern to detect for-each loops
   */
  private getForEachPattern(): RegExp {
    return /for\s*\(\s*([\w.<>]+)\s+(\w+)\s*:\s*(\w+(?:\.\w+\(\))?)\s*\)\s*\{([^}]*)\}/gs;
  }

  /**
   * Pattern to detect filters in for-each loops
   */
  private getFilterPattern(itemVar: string): RegExp {
    return new RegExp(`if\\s*\\(\\s*${itemVar}\\s*\\.([^)]+)\\)\\s*\\{([^}]*)\\}`, 'g');
  }

  /**
   * Pattern to detect transformations in for-each loops
   */
  private getMapPattern(itemVar: string): RegExp {
    // Example: String upperCase = item.toUpperCase();
    return new RegExp(`(\\w+)\\s+(\\w+)\\s*=\\s*${itemVar}\\s*\\.([^;]+);`, 'g');
  }

  canModernize(_document: vscode.TextDocument, text: string): boolean {
    const pattern = this.getForEachPattern();
    pattern.lastIndex = 0; // Reset regex state
    return pattern.test(text);
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const matches = this.findAllMatches(document, this.getForEachPattern());
    
    // Filter to include only for-each loops that can be converted
    const validMatches = matches.filter(m => {
      const text = document.getText(m.range);
      
      // Extract loop information
      const [_, itemType, itemVar, collection, body] = m.match;
      
      // Check if the loop body is suitable for conversion
      return this.isBodyConvertible(body, itemVar);
    });
    
    return validMatches.map(m => m.range);
  }

  /**
   * Checks if the loop body can be converted to Stream API
   * @param body Loop body
   * @param itemVar Item variable name
   */
  private isBodyConvertible(body: string, itemVar: string): boolean {
    // Simple cases that are good candidates for conversion:
    
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
    
    // More complex cases may not be good for automatic conversion
    return false;
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    const pattern = this.getForEachPattern();
    
    return text.replace(pattern, (_match, itemType, itemVar, collection, body) => {
      // Analyze the loop body to determine stream operations
      const operations: string[] = [];
      
      // Check for filters (if statements)
      const filterPattern = this.getFilterPattern(itemVar);
      let filteredBody = body;
      let filterMatch;
      
      while ((filterMatch = filterPattern.exec(body)) !== null) {
        const condition = filterMatch[1].trim();
        // Add filter operation
        operations.push(`.filter(${itemVar} -> ${itemVar}.${condition})`);
        
        // Remove the if from the body for additional processing
        filteredBody = filteredBody.replace(filterMatch[0], filterMatch[2]);
      }
      
      // Check for transformations (assignments)
      const mapPattern = this.getMapPattern(itemVar);
      let mapMatch;
      
      while ((mapMatch = mapPattern.exec(filteredBody)) !== null) {
        const transformation = mapMatch[3].trim();
        // Check if we can use a method reference
        if (transformation.endsWith(')') && !transformation.includes('(', transformation.indexOf('(')+1)) {
          const methodName = transformation.substring(0, transformation.indexOf('('));
          operations.push(`.map(${itemType}::${methodName})`);
        } else {
          operations.push(`.map(${itemVar} -> ${itemVar}.${transformation})`);
        }
      }
      
      // Check for forEach (System.out.println)
      if (filteredBody.includes(`System.out.println(${itemVar})`) || 
          filteredBody.includes(`System.out.println(${itemVar}.`)) {
        
        if (filteredBody.includes(`System.out.println(${itemVar})`)) {
          operations.push('.forEach(System.out::println)');
        } else {
          // Extract the part after System.out.println(item.
          const printPattern = new RegExp(`System\\.out\\.println\\(${itemVar}\\.(.*?)\\)`, 'g');
          let printMatch;
          
          if ((printMatch = printPattern.exec(filteredBody)) !== null) {
            const printTransformation = printMatch[1].trim();
            if (operations.some(op => op.includes('.map('))) {
              operations.push('.forEach(System.out::println)');
            } else {
              operations.push(`.map(${itemVar} -> ${itemVar}.${printTransformation})`);
              operations.push('.forEach(System.out::println)');
            }
          } else {
            operations.push('.forEach(System.out::println)');
          }
        }
      }
      
      // Check for collect (result.add)
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
          
          // Add a note about the required import
          return `// Importe: import java.util.stream.Collectors;\n${collection}.stream()\n  ${operations.join('\n  ')};`;
        }
      }
      
      // If we didn't detect a terminal operation, add collect as default
      if (!operations.some(op => op.includes('.forEach(') || op.includes('.collect('))) {
        operations.push('.collect(Collectors.toList())');
        return `// Importe: import java.util.stream.Collectors;\n${collection}.stream()\n  ${operations.join('\n  ')};`;
      }
      
      // Build the stream expression, ensuring it ends with a semicolon
      let result = `${collection}.stream()\n  ${operations.join('\n  ')}`;
      if (!result.endsWith(';')) {
        result += ';';
      }
      return result;
    });
  }
}