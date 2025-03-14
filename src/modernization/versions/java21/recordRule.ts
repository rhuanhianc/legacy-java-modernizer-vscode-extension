import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para converter classes DTO para Records
 */
export class RecordRule extends AbstractModernizationRule {
  constructor() {
    super(
      'record-for-dto',
      'Record para DTOs',
      'Converte classes simples de dados (DTOs) para Records, reduzindo significativamente o código boilerplate',
      16, // Introduzido como preview no Java 16, estável no Java 17
      [17, 21],
      RuleComplexity.COMPLEX,
      {
        readability: 10,
        performance: 7,
        maintenance: 9
      },
      {
        before: `public class Person {\n  private final String name;\n  private final int age;\n\n  public Person(String name, int age) {\n    this.name = name;\n    this.age = age;\n  }\n\n  public String getName() {\n    return name;\n  }\n\n  public int getAge() {\n    return age;\n  }\n\n  @Override\n  public boolean equals(Object o) {\n    if (this == o) return true;\n    if (o == null || getClass() != o.getClass()) return false;\n    Person person = (Person) o;\n    return age == person.age && Objects.equals(name, person.name);\n  }\n\n  @Override\n  public int hashCode() {\n    return Objects.hash(name, age);\n  }\n\n  @Override\n  public String toString() {\n    return "Person{" +\n      "name='" + name + '\\',' +\n      "age=" + age +\n      '}';\n  }\n}`,
        after: `public record Person(String name, int age) {}`
      }
    );
  }

  /**
   * Padrão para detectar classes candidatas a serem convertidas para Records
   */
  private getClassPattern(): RegExp {
    return /public\s+class\s+(\w+)(?:\s+implements\s+[^{]+)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
  }

  canModernize(document: vscode.TextDocument, text: string): boolean {
    const pattern = this.getClassPattern();
    pattern.lastIndex = 0;
    
    // Verificar se o texto contém classes
    if (!pattern.test(text)) {
      return false;
    }
    
    // Resetar o padrão
    pattern.lastIndex = 0;
    
    // Verificar se alguma classe é candidata a Record
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const className = match[1];
      const classBody = match[2];
      
      if (this.isRecordCandidate(classBody)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Verifica se uma classe é candidata a ser convertida para Record
   * @param classBody Corpo da classe
   */
  private isRecordCandidate(classBody: string): boolean {
    // Verificar se contém apenas campos finais privados
    const finalFieldPattern = /private\s+final\s+([^;]+)\s+(\w+);/g;
    
    // Verificar se há campos finais
    if (!finalFieldPattern.test(classBody)) {
      return false;
    }
    
    // Resetar o padrão
    finalFieldPattern.lastIndex = 0;
    
    // Verificar se tem construtor que inicializa todos os campos
    const constructorPattern = /public\s+\w+\s*\([^)]*\)\s*\{[^{}]*\}/g;
    if (!constructorPattern.test(classBody)) {
      return false;
    }
    
    // Verificar se tem getters para todos os campos
    const getterPattern = /public\s+[^()]+\s+get\w+\(\)\s*\{[^{}]*\}/g;
    if (!getterPattern.test(classBody)) {
      return false;
    }
    
    // Verificar se tem equals, hashCode e toString
    if (!classBody.includes("equals(") || !classBody.includes("hashCode()") || !classBody.includes("toString()")) {
      return false;
    }
    
    // Verificar se a classe não tem métodos que modificam o estado
    if (classBody.includes("void set") || classBody.includes("public void")) {
      return false;
    }
    
    return true;
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const pattern = this.getClassPattern();
    const matches = this.findAllMatches(document, pattern);
    
    // Filtrar para incluir apenas classes que podem ser convertidas para Records
    const validMatches = matches.filter(m => {
      const [_, className, classBody] = m.match;
      return this.isRecordCandidate(classBody);
    });
    
    return validMatches.map(m => m.range);
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    const pattern = this.getClassPattern();
    
    return text.replace(pattern, (match, className, classBody) => {
      // Verificar se é candidato a Record
      if (!this.isRecordCandidate(classBody)) {
        return match;
      }
      
      // Extrair campos
      const fields = [];
      const finalFieldPattern = /private\s+final\s+([^;]+)\s+(\w+);/g;
      let fieldMatch;
      
      while ((fieldMatch = finalFieldPattern.exec(classBody)) !== null) {
        const type = fieldMatch[1].trim();
        const name = fieldMatch[2].trim();
        fields.push({ type, name });
      }
      
      // Criar os parâmetros do Record
      const parameters = fields.map(field => `${field.type} ${field.name}`).join(', ');
      
      // Verificar se há interfaces implementadas
      const implementsMatch = match.match(/public\s+class\s+\w+\s+implements\s+([^{]+)/);
      const implements_ = implementsMatch ? ` implements ${implementsMatch[1].trim()}` : '';
      
      // Verificar se há métodos personalizados (exceto getters, equals, hashCode, toString)
      const customMethods = [];
      
      // Padrão para métodos que não são getters, equals, hashCode ou toString
      const methodPattern = /public\s+(?!boolean\s+equals|int\s+hashCode|String\s+toString|void\s+set|get\w+)([^{]+)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      let methodMatch;
      
      while ((methodMatch = methodPattern.exec(classBody)) !== null) {
        const methodSignature = methodMatch[1].trim();
        const methodBody = methodMatch[2];
        
        // Adicionar apenas se não for um getter
        if (!methodSignature.startsWith('get')) {
          customMethods.push(`public ${methodSignature} {${methodBody}}`);
        }
      }
      
      // Se houver métodos personalizados, criar um Record com corpo
      if (customMethods.length > 0) {
        return `public record ${className}(${parameters})${implements_} {\n  ${customMethods.join('\n\n  ')}\n}`;
      }
      
      // Caso contrário, criar um Record simples
      return `public record ${className}(${parameters})${implements_} {}`;
    });
  }
}