import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';
import { ImportManager, JavaImport } from '../../../utils/importManager';

/**
 * Rule to use Optional for null checks
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
   * Pattern to detect simple null checks
   */
  private getNullCheckPattern(): RegExp {
    // More precise pattern:
    // - Captures only if statements with simple null checks
    // - Avoids capturing complex conditions (with && or ||)
    // - Ensures that the checked variable appears in the if body
    return /if\s*\(\s*(\w+)\s*!=\s*null\s*\)\s*\{([^{}]+|(?:\{[^{}]*\})*)\}/gs;
  }

  /**
   * Pattern to detect null checks with else
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
    
    // Filter for null checks that can be converted to Optional
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
   * Checks if the code is inside a method of a class
   * This helps filter cases where the transformation would not be appropriate
   */
  private isInMethod(document: vscode.TextDocument, range: vscode.Range): boolean {
    // Get the text before our range
    const startOffset = document.offsetAt(range.start);
    const documentText = document.getText();
    const textBefore = documentText.substring(0, startOffset);
    
    // Check if we're in a method
    // This is a simplified check, a more robust check would use AST
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
    
    // Check the depth of braces to see if we're still in the method body
    const methodText = textBefore.substring(lastMethodStart);
    const openBraces = (methodText.match(/\{/g) || []).length;
    const closeBraces = (methodText.match(/\}/g) || []).length;
    
    return openBraces > closeBraces;
  }

  /**
   * Checks if a simple if body can be converted to Optional
   * Improved for more precise analysis
   * @param body If body
   * @param varName Checked variable name
   */
  private isSimpleBodyConvertible(body: string, varName: string): boolean {
    // Check if the body uses the checked variable
    if (!body.includes(varName)) {
      return false;
    }
    
    // Avoid very complex cases
    if (body.includes("if (") || 
        body.includes("for (") || 
        body.includes("while (") || 
        body.includes("switch (") ||
        body.includes("try {") ||
        body.includes("synchronized")) {
      return false;
    }
    
    // Check if the body contains declared/initialized variables
    // that are used after the if block - this case should not be converted
    const varDeclarationPattern = /\b(?:var|int|long|double|float|boolean|char|short|byte|String|(?:[A-Z]\w+))\s+(\w+)\s*=/g;
    let varDeclarationMatch;
    while ((varDeclarationMatch = varDeclarationPattern.exec(body)) !== null) {
      // If there are variable declarations, don't convert
      return false;
    }
    
    return true;
  }

  /**
   * Checks if if/else bodies can be converted to Optional
   * Improved for more precise analysis
   * @param ifBody If body
   * @param elseBody Else body
   * @param varName Checked variable name
   */
  private isWithElseBodyConvertible(ifBody: string, elseBody: string, varName: string): boolean {
    // Check if the bodies are simple enough for conversion
    if (!this.isSimpleBodyConvertible(ifBody, varName)) {
      return false;
    }
    
    // The else should not use the variable
    if (elseBody.includes(varName)) {
      return false;
    }
    
    // Else with few lines
    return elseBody.trim().split('\n').length <= 3;
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    
    // Ensure we add the Optional import
    this.prepareModernization(document).catch(error => {
      console.error("Error adding Optional import:", error);
    });
    
    // Try to convert null check with else first
    const withElsePattern = this.getNullCheckWithElsePattern();
    if (withElsePattern.test(text)) {
      return this.convertWithElseNullCheck(text);
    }
    
    // Try to convert simple null check without else
    const simplePattern = this.getNullCheckPattern();
    return this.convertSimpleNullCheck(text);
  }

  /**
   * Prepares the document for modernization by adding necessary imports
   * Call this method before applying modernizations
   */
  async prepareModernization(document: vscode.TextDocument): Promise<void> {
    // Add the import for java.util.Optional
    const optionalImport: JavaImport = {
      packageName: 'java.util',
      className: 'Optional'
    };
    
    try {
      const edit = await ImportManager.addImport(document, optionalImport);
      if (edit) {
        await vscode.workspace.applyEdit(edit);
      }
    } catch (error) {
      console.error("Error adding Optional import:", error);
    }
  }

  /**
   * Converts a simple null check to Optional
   * @param text Text to convert
   */
  private convertSimpleNullCheck(text: string): string {
    const pattern = this.getNullCheckPattern();
    pattern.lastIndex = 0;
    
    return text.replace(pattern, (_match, varName, body) => {
      // Clean the body by removing spaces and comments
      const cleanBody = this.cleanBody(body);
      
      // Check if the body contains only one line
      const lines = cleanBody.trim().split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length === 1) {
        const line = lines[0].trim();
        
        // Check if it's a case where we can use a method reference
        if (line.startsWith('System.out.println(') && line.includes(`${varName}.`)) {
          const methodCall = line.substring(line.indexOf(`${varName}.`) + varName.length + 1, line.lastIndexOf(')'));
          
          // If it's a simple method call with no additional arguments
          if (!methodCall.includes('(')) {
            return `Optional.ofNullable(${varName})\n  .ifPresent(${varName} -> System.out.println(${varName}.${methodCall}));`;
          }
        }
        
        // For simple method calls
        const methodCallMatch = line.match(new RegExp(`${varName}\\.\\w+\\([^)]*\\);`));
        if (methodCallMatch) {
          const methodCall = methodCallMatch[0].substring(0, methodCallMatch[0].indexOf(';'));
          const methodName = methodCall.substring(methodCall.indexOf('.') + 1);
          
          return `Optional.ofNullable(${varName})\n  .ifPresent(${varName} -> ${varName}.${methodName});`;
        }
      }
      
      // For more complex cases, wrap the body in a lambda
      return `Optional.ofNullable(${varName})\n  .ifPresent(${varName} -> {\n    ${cleanBody}\n  });`;
    });
  }

  /**
   * Converts a null check with else to Optional
   * @param text Text to convert
   */
  private convertWithElseNullCheck(text: string): string {
    const pattern = this.getNullCheckWithElsePattern();
    pattern.lastIndex = 0;
    
    return text.replace(pattern, (_match, varName, ifBody, elseBody) => {
      // Clean the bodies by removing spaces and comments
      const cleanIfBody = this.cleanBody(ifBody);
      const cleanElseBody = this.cleanBody(elseBody);
      
      // Check if the if body has a return
      const hasReturn = cleanIfBody.includes('return ');
      
      if (hasReturn) {
        // If the body has a return, use orElse/orElseGet/orElseThrow as appropriate
        const returnMatch = cleanIfBody.match(/return\s+(.+);/);
        
        if (returnMatch) {
          const returnValue = returnMatch[1].trim();
          
          // Check if the else also has a return
          const elseReturnMatch = cleanElseBody.match(/return\s+(.+);/);
          
          if (elseReturnMatch) {
            const elseReturnValue = elseReturnMatch[1].trim();
            
            // If the else returns null, use orElse(null)
            if (elseReturnValue === 'null') {
              return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElse(null);`;
            }
            
            // If the else returns another value, use orElse
            return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElse(${elseReturnValue});`;
          }
          
          // If the else doesn't have a return, it might be a case for orElseGet with lambda
          if (cleanElseBody.trim().length > 0) {
            return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElseGet(() -> {\n    ${cleanElseBody}\n    return null;\n  });`;
          }
          
          // If the else is empty, use orElse(null)
          return `Optional.ofNullable(${varName})\n  .map(${varName} -> ${returnValue})\n  .orElse(null);`;
        }
      }
      
      // For simple cases without return, use ifPresentOrElse
      return `Optional.ofNullable(${varName})\n  .ifPresentOrElse(\n    ${varName} -> {\n      ${cleanIfBody}\n    },\n    () -> {\n      ${cleanElseBody}\n    }\n  );`;
    });
  }

  /**
   * Cleans the body of the code by removing comments and extra spaces
   * @param body Code body
   */
  private cleanBody(body: string): string {
    return body
      .replace(/\/\/[^\n]*/g, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .trim();
  }
}