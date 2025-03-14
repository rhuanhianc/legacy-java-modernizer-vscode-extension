import * as vscode from 'vscode';
import { LambdaRule } from '../../src/modernization/versions/java8/lambdaRule';

describe('LambdaRule', () => {
  let lambdaRule: LambdaRule;
  
  beforeEach(() => {
    lambdaRule = new LambdaRule();
  });
  
  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(lambdaRule.id).toBe('java8.lambda');
      expect(lambdaRule.name).toBe('Expressões Lambda');
      expect(lambdaRule.impact.readability).toBeGreaterThan(0);
      expect(lambdaRule.impact.performance).toBeGreaterThanOrEqual(0);
      expect(lambdaRule.impact.maintenance).toBeGreaterThan(0);
      expect(lambdaRule.isEnabled()).toBe(true);
    });
  });
  
  describe('Analysis', () => {
    it('should detect anonymous classes that can be converted to lambdas', async () => {
      // Java código com classes anônimas
      const javaCode = `
package com.example;

import java.util.Comparator;
import java.util.List;
import java.util.ArrayList;

public class Test {
    public void testMethod() {
        // Lambda-eligible anonymous class implementing a functional interface
        Comparator<String> comparator = new Comparator<String>() {
            @Override
            public int compare(String s1, String s2) {
                return s1.compareTo(s2);
            }
        };
        
        // Another lambda-eligible anonymous class
        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                System.out.println("Hello World");
            }
        };
        
        // Non-functional interface, should not be detected
        Object obj = new Object() {
            @Override
            public String toString() {
                return "custom toString";
            }
        };
        
        // Multiple methods, should not be detected
        ActionListener listener = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                System.out.println("Action performed");
            }
            
            public void extraMethod() {
                System.out.println("Extra method");
            }
        };
    }
}`;
      
      const document = await vscode.workspace.openTextDocument({ content: javaCode, language: 'java' });
      const ranges = await lambdaRule.analyzeDocument(document);
      
      // Devemos detectar 2 classes anônimas elegíveis para lambda
      expect(ranges).toHaveLength(2);
      
      // Verificar se os ranges contêm as classes corretas
      const comparatorRange = ranges.find(range => 
        document.getText(range).includes('Comparator<String>'));
      const runnableRange = ranges.find(range => 
        document.getText(range).includes('Runnable'));
      
      expect(comparatorRange).toBeDefined();
      expect(runnableRange).toBeDefined();
    });
    
    it('should not detect non-functional interfaces or complex anonymous classes', async () => {
      const javaCode = `
package com.example;

public class Test {
    public void testMethod() {
        // Non-functional interface
        Object obj = new Object() {
            @Override
            public String toString() {
                return "custom toString";
            }
        };
        
        // Class with multiple methods
        MyInterface complex = new MyInterface() {
            @Override
            public void method1() {
                System.out.println("Method 1");
            }
            
            @Override
            public void method2() {
                System.out.println("Method 2");
            }
        };
    }
}

interface MyInterface {
    void method1();
    void method2();
}`;
      
      const document = await vscode.workspace.openTextDocument({ content: javaCode, language: 'java' });
      const ranges = await lambdaRule.analyzeDocument(document);
      
      // Não devemos detectar nenhuma classe anônima
      expect(ranges).toHaveLength(0);
    });
  });
  
  describe('Modernization', () => {
    it('should convert Comparator anonymous class to lambda expression', async () => {
      const anonymousClass = `new Comparator<String>() {
            @Override
            public int compare(String s1, String s2) {
                return s1.compareTo(s2);
            }
        }`;
      
      const document = await vscode.workspace.openTextDocument({ content: anonymousClass, language: 'java' });
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
      );
      
      const modernizedText = lambdaRule.getModernizedText(document, range);
      
      // Verificar se o resultado contém a expressão lambda
      expect(modernizedText).toContain('->');
      expect(modernizedText).not.toContain('@Override');
      expect(modernizedText).not.toContain('new Comparator');
      // Deve conter os parâmetros originais
      expect(modernizedText).toContain('String s1, String s2');
      // Deve conter o corpo do método
      expect(modernizedText).toContain('s1.compareTo(s2)');
    });
    
    it('should convert Runnable anonymous class to lambda expression', async () => {
      const anonymousClass = `new Runnable() {
            @Override
            public void run() {
                System.out.println("Hello World");
            }
        }`;
      
      const document = await vscode.workspace.openTextDocument({ content: anonymousClass, language: 'java' });
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
      );
      
      const modernizedText = lambdaRule.getModernizedText(document, range);
      
      // Verificar se o resultado contém a expressão lambda
      expect(modernizedText).toContain('->');
      expect(modernizedText).not.toContain('@Override');
      expect(modernizedText).not.toContain('new Runnable');
      // Sem parâmetros para Runnable
      expect(modernizedText).toContain('() ->');
      // Deve conter o corpo do método
      expect(modernizedText).toContain('System.out.println("Hello World")');
    });
    
    it('should handle complex method bodies correctly', async () => {
      const anonymousClass = `new Predicate<String>() {
            @Override
            public boolean test(String value) {
                if (value == null) {
                    return false;
                }
                value = value.trim();
                return value.length() > 0 && 
                       Character.isUpperCase(value.charAt(0));
            }
        }`;
      
      const document = await vscode.workspace.openTextDocument({ content: anonymousClass, language: 'java' });
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
      );
      
      const modernizedText = lambdaRule.getModernizedText(document, range);
      
      // Verificar se o resultado contém a expressão lambda
      expect(modernizedText).toContain('->');
      expect(modernizedText).toContain('value');
      expect(modernizedText).toContain('if (value == null)');
      expect(modernizedText).toContain('return false');
      expect(modernizedText).toContain('return value.length() > 0');
      // Para métodos com múltiplas linhas, deve manter as chaves
      expect(modernizedText).toContain('{');
      expect(modernizedText).toContain('}');
    });
  });
});