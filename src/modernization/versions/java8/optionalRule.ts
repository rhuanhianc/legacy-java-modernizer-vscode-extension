import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';
import { ImportManager, JavaImport } from '../../../utils/importManager';

/**
 * Regra para usar Optional para verificações de nulo
 */
export class OptionalRule extends AbstractModernizationRule {
  constructor() {
    super(
      'optional-for-null-check',
      'Optional para Verificações de Nulo',
      'Substitui verificações de nulo explícitas por Optional para tornar o código mais robusto e expressivo',
      8,
      [8, 9, 11, 15, 17, 21],
      RuleComplexity.MEDIUM,
      {
        readability: 8,
        performance: 5,
        maintenance: 8
      },
      {
        before: `if (user != null) {\n  System.out.println(user.getName());\n}`,
        after: `Optional.ofNullable(user)\n  .ifPresent(u -> System.out.println(u.getName()));`
      }
    );
  }

  /**
   * Padrão para detectar verificações de nulo simples
   * Melhorado para evitar falsos positivos
   */
  private getNullCheckPattern(): RegExp {
    // Padrão mais preciso:
    // - Captura apenas if com verificação de null simples
    // - Evita capturar condições complexas (com && ou ||)
    // - Garante que a variável verificada aparece no corpo do if
    return /if\s*\(\s*(\w+)\s*!=\s*null\s*\)\s*\{([^{}]+|(?:\{[^{}]*\})*)\}/gs;
  }

  /**
   * Padrão para detectar verificações de nulo com else
   * Melhorado para evitar falsos positivos
   */
  private getNullCheckWithElsePattern(): RegExp {
    return /if\s*\(\s*(\w+)\s*!=\s*null\s*\)\s*\{([^{}]+|(?:\{[^{}]*\})*)\}\s*else\s*\{([^{}]+|(?:\{[^{}]*\})*)\}/gs;
  }

  canModernize(_document: vscode.TextDocument, text: string): boolean {
    const simplePattern = this.getNullCheckPattern();
    const withElsePattern = this.getNullCheckWithElsePattern();
    
    simplePattern.lastIndex = 0;
    withElsePattern.lastIndex = 0;
    
    return simplePattern.test(text) || withElsePattern.test(text);
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const simpleMatches = this.findAllMatches(document, this.getNullCheckPattern());
    const withElseMatches = this.findAllMatches(document, this.getNullCheckWithElsePattern());
    
    // Filtrar para verificações que podem ser convertidas em Optional
    const validSimpleMatches = simpleMatches.filter(m => {
      const [_, varName, body] = m.match;
      return this.isSimpleBodyConvertible(body, varName) && !this.isInMethod(document, m.range);
    });
    
    const validWithElseMatches = withElseMatches.filter(m => {
      const [_, varName, ifBody, elseBody] = m.match;
      return this.isWithElseBodyConvertible(ifBody, elseBody, varName) && !this.isInMethod(document, m.range);
    });
    
    return [...validSimpleMatches, ...validWithElseMatches].map(m => m.range);
  }

  /**
   * Verifica se o código está dentro de um método de uma classe
   * Isto ajuda a filtrar casos onde a transformação não seria apropriada
   */
  private isInMethod(document: vscode.TextDocument, range: vscode.Range): boolean {
    // Obter o texto antes do nosso intervalo
    const startOffset = document.offsetAt(range.start);
    const documentText = document.getText();
    const textBefore = documentText.substring(0, startOffset);
    
    // Verificar se estamos em um método
    // Esta é uma verificação simplificada, uma verificação mais robusta usaria AST
    const methodSignaturePattern = /\s(public|private|protected)\s+\w+\s+\w+\s*\([^)]*\)\s*\{/g;
    
    let match;
    let inMethod = false;
    let lastMethodStart = -1;
    
    while ((match = methodSignaturePattern.exec(textBefore)) !== null) {
      lastMethodStart = match.index;
      inMethod = true;
    }
    
    if (!inMethod) {
      return false;
    }
    
    // Verificar a profundidade das chaves para ver se ainda estamos no corpo do método
    const methodText = textBefore.substring(lastMethodStart);
    const openBraces = (methodText.match(/\{/g) || []).length;
    const closeBraces = (methodText.match(/\}/g) || []).length;
    
    return openBraces > closeBraces;
  }

  /**
   * Verifica se o corpo de um if simples pode ser convertido para Optional
   * Melhorado para análise mais precisa
   * @param body Corpo do if
   * @param varName Nome da variável verificada
   */
  private isSimpleBodyConvertible(body: string, varName: string): boolean {
    // Verificar se o corpo usa a variável verificada
    if (!body.includes(varName)) {
      return false;
    }
    
    // Evitar casos muito complexos
    if (body.includes("if (") || 
        body.includes("for (") || 
        body.includes("while (") || 
        body.includes("switch (") ||
        body.includes("try {") ||
        body.includes("synchronized")) {
      return false;
    }
    
    // Verificar se o corpo contém variáveis declaradas/inicializadas
    // que são usadas após o bloco if - esse caso não deve ser convertido
    const varDeclarationPattern = /\b(?:var|int|long|double|float|boolean|char|short|byte|String|(?:[A-Z]\w+))\s+(\w+)\s*=/g;
    let varDeclarationMatch;
    while ((varDeclarationMatch = varDeclarationPattern.exec(body)) !== null) {
      // Se há declarações de variáveis, não converter
      return false;
    }
    
    return true;
  }

  /**
   * Verifica se os corpos de if/else podem ser convertidos para Optional
   * Melhorado para análise mais precisa
   * @param ifBody Corpo do if
   * @param elseBody Corpo do else
   * @param varName Nome da variável verificada
   */
  private isWithElseBodyConvertible(ifBody: string, elseBody: string, varName: string): boolean {
    // Verificar se os corpos são simples o suficiente para conversão
    if (!this.isSimpleBodyConvertible(ifBody, varName)) {
      return false;
    }
    
    // O else não deve usar a variável
    if (elseBody.includes(varName)) {
      return false;
    }
    
    // Else com poucas linhas
    return elseBody.trim().split('\n').length <= 3;
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    
    // Add import automatically
    this.prepareModernization(document).catch(error => {
      console.error("Error adding Optional import:", error);
    });
    
    // Tentar converter verificação com else primeiro
    const withElsePattern = this.getNullCheckWithElsePattern();
    if (withElsePattern.test(text)) {
      return this.convertWithElseNullCheck(text);
    }
    
    // Tentar converter verificação simples sem else
    const simplePattern = this.getNullCheckPattern();
    return this.convertSimpleNullCheck(text);
  }

  /**
   * Prepara o documento para modernização adicionando importações necessárias
   * Chame este método antes de aplicar as modernizações
   */
  async prepareModernization(document: vscode.TextDocument): Promise<void> {
    // Adicionar o import para java.util.Optional
    const optionalImport: JavaImport = {
      packageName: 'java.util',
      className: 'Optional'
    };
    
    const edit = await ImportManager.addImport(document, optionalImport);
    if (edit) {
      await vscode.workspace.applyEdit(edit);
    }
  }

  /**
   * Converte verificação de nulo simples para Optional
   * @param text Texto a ser convertido
   */
  private convertSimpleNullCheck(text: string): string {
    const pattern = this.getNullCheckPattern();
    pattern.lastIndex = 0;
    
    return text.replace(pattern, (_match, varName, body) => {
      // Limpar o corpo removendo espaços e comentários
      const cleanBody = this.cleanBody(body);
      
      // Verificar se o corpo contém apenas uma linha
      const lines = cleanBody.trim().split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length === 1) {
        const line = lines[0].trim();
        
        // Verificar se é um caso onde podemos usar um método de referência
        if (line.startsWith('System.out.println(') && line.includes(`${varName}.`)) {
          const methodCall = line.substring(line.indexOf(`${varName}.`) + varName.length + 1, line.lastIndexOf(')'));
          
          // Se for uma chamada de método simples sem argumentos adicionais
          if (!methodCall.includes('(')) {
            return `Optional.ofNullable(${varName})\n  .ifPresent(${varName} -> System.out.println(${varName}.${methodCall}))`;
          }
        }
        
        // Para chamadas de método simples
        const methodCallMatch = line.match(new RegExp(`${varName}\\.\\w+\\([^)]*\\);`));
        if (methodCallMatch) {
          const methodCall = methodCallMatch[0].substring(0, methodCallMatch[0].indexOf(';'));
          const methodName = methodCall.substring(methodCall.indexOf('.') + 1);
          
          return `Optional.ofNullable(${varName})\n  .ifPresent(${varName} -> ${varName}.${methodName})`;
        }
      }
      
      // Para casos mais complexos, envolver o corpo em um lambda
      return `Optional.ofNullable(${varName})\n  .ifPresent(${varName} -> {\n    ${cleanBody}\n  })`;
    });
  }

  /**
   * Converte verificação de nulo com else para Optional
   * @param text Texto a ser convertido
   */
  private convertWithElseNullCheck(text: string): string {
    const pattern = this.getNullCheckWithElsePattern();
    pattern.lastIndex = 0;
    
    return text.replace(pattern, (_match, varName, ifBody, elseBody) => {
      // Limpar os corpos removendo espaços e comentários
      const cleanIfBody = this.cleanBody(ifBody);
      const cleanElseBody = this.cleanBody(elseBody);
      
      // Verificar se o corpo do if tem um retorno
      const hasReturn = cleanIfBody.includes('return ');
      
      if (hasReturn) {
        // Se o corpo tiver um retorno, usar orElse/orElseGet/orElseThrow conforme apropriado
        const returnMatch = cleanIfBody.match(/return\s+(.+);/);
        
        if (returnMatch) {
          const returnValue = returnMatch[1].trim();
          
          // Verificar se o else também tem um retorno
          const elseReturnMatch = cleanElseBody.match(/return\s+(.+);/);
          
          if (elseReturnMatch) {
            const elseReturnValue = elseReturnMatch[1].trim();
            
            // Se o else retornar null, usar orElse(null)
            if (elseReturnValue === 'null') {
              return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElse(null)`;
            }
            
            // Se o else retornar outro valor, usar orElse
            return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElse(${elseReturnValue})`;
          }
          
          // Se o else não tiver retorno, pode ser um caso para orElseGet com lambda
          if (cleanElseBody.trim().length > 0) {
            return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElseGet(() -> {\n    ${cleanElseBody}\n    return null;\n  })`;
          }
          
          // Se o else estiver vazio, usar orElse(null)
          return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElse(null)`;
        }
      }
      
      // Para casos simples sem retorno, usar ifPresentOrElse
      return `Optional.ofNullable(${varName})\n  .ifPresentOrElse(\n    ${varName} -> {\n      ${cleanIfBody}\n    },\n    () -> {\n      ${cleanElseBody}\n    }\n  )`;
    });
  }

  /**
   * Limpa o corpo do código removendo comentários e espaços extras
   * @param body Corpo do código
   */
  private cleanBody(body: string): string {
    return body
      .replace(/\/\/[^\n]*/g, '') // Remover comentários de linha
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remover comentários de bloco
      .trim();
  }
}