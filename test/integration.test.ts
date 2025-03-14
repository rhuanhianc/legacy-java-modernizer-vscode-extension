// test/integration.test.ts
import * as vscode from 'vscode';
import { PatternAnalyzer } from '../src/analyzer/patternAnalyzer';
import { Java8Rules } from '../src/modernization/versions/java8/java8Rules';
import { RefactoringProvider } from '../src/refactor/refactoringProvider';

// Função auxiliar para criar mock do WorkspaceConfiguration
function createMockConfiguration(targetVersion = '8', excludedFiles = [], excludedFolders = []): vscode.WorkspaceConfiguration {
  return {
    get: (key: string, defaultValue?: any) => {
      if (key === 'targetJavaVersion') return targetVersion;
      if (key === 'excludedFiles') return excludedFiles;
      if (key === 'excludedFolders') return excludedFolders;
      return defaultValue;
    },
    update: (section: string, value: any, configurationTarget?: boolean | vscode.ConfigurationTarget): Thenable<void> => {
      return Promise.resolve();
    },
    has: (section: string): boolean => {
      return true;
    },
    inspect: (section: string) => {
      return undefined;
    }
  } as vscode.WorkspaceConfiguration;
}

// This is an integration test that tests the entire workflow from analysis to refactoring
describe('Integration Test - Full Modernization Workflow', () => {
  beforeAll(() => {
    // Register Java 8 rules
    Java8Rules.register();
  });
  
  test('Workflow from analysis to refactoring', async () => {
    const testCode = `
package com.example;

import java.util.ArrayList;
import java.util.List;

public class TestClass {
    public void testMethod() {
        // Lambda rule test case
        Runnable r = new Runnable() {
            @Override
            public void run() {
                System.out.println("Hello");
            }
        };
        
        // Stream API rule test case
        List<String> items = new ArrayList<>();
        items.add("apple");
        items.add("banana");
        items.add("orange");
        
        List<String> filtered = new ArrayList<>();
        for (String item : items) {
            if (item.length() > 5) {
                filtered.add(item.toUpperCase());
            }
        }
        
        // Optional rule test case
        String value = getValue();
        if (value != null) {
            System.out.println(value.length());
        }
    }
    
    private String getValue() {
        return "test";
    }
}`;

    // Create a mock document
    const document = await vscode.workspace.openTextDocument({
      content: testCode,
      language: 'java'
    });
    
    // Create analyzer
    const analyzer = new PatternAnalyzer();
    
    // Update configuration
    // Mock config to use Java 8
    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'legacyJavaModernizer') {
        return createMockConfiguration('8', [], []);
      }
      return createMockConfiguration();
    });
    
    analyzer.updateConfiguration();
    
    // Create refactoring provider
    const refactoringProvider = new RefactoringProvider(analyzer);
    
    // Analyze the test file
    const uri = vscode.Uri.file('test-file.java');
    const matches = await analyzer.analyzeFile(uri);
    
    // Check that we found at least 3 patterns (one for each rule)
    expect(matches.length).toBeGreaterThanOrEqual(3);
    
    // Map rule IDs to counts
    const ruleCounts = matches.reduce((counts, match) => {
      counts[match.rule.id] = (counts[match.rule.id] || 0) + 1;
      return counts;
    }, {} as {[key: string]: number});
    
    // Check that we found each rule
    expect(ruleCounts['lambda-for-anonymous-class']).toBeGreaterThanOrEqual(1);
    expect(ruleCounts['for-each-to-stream']).toBeGreaterThanOrEqual(1);
    expect(ruleCounts['optional-for-null-check']).toBeGreaterThanOrEqual(1);
    
    // Get matches by rule
    const lambdaMatch = matches.find(m => m.rule.id === 'lambda-for-anonymous-class');
    const streamMatch = matches.find(m => m.rule.id === 'for-each-to-stream');
    const optionalMatch = matches.find(m => m.rule.id === 'optional-for-null-check');
    
    // Check that each match has a suggested replacement
    expect(lambdaMatch?.suggestedReplacement).toContain('() -> System.out.println("Hello")');
    expect(streamMatch?.suggestedReplacement).toContain('.stream()');
    expect(optionalMatch?.suggestedReplacement).toContain('Optional.ofNullable');
    
    // Mock the applyEdit call
    const applyEditSpy = jest.spyOn(vscode.workspace, 'applyEdit');
    applyEditSpy.mockResolvedValue(true);
    
    // Test applying a refactoring
    if (lambdaMatch) {
      const success = await refactoringProvider.applyRefactoring(lambdaMatch);
      expect(success).toBe(true);
      expect(applyEditSpy).toHaveBeenCalled();
    }
    
    // Test applying all refactorings in a file
    const fileSuccess = await refactoringProvider.applyFileRefactorings(uri, matches);
    expect(fileSuccess).toBe(true);
    
    // Test the progress reporting 
    let progressReportCalled = false;
    const progressCallback = jest.fn(() => {
      progressReportCalled = true;
    });
    
    const appliedCount = await refactoringProvider.applyAllRefactorings(matches, progressCallback);
    expect(appliedCount).toBeGreaterThan(0);
    expect(progressReportCalled).toBe(true);
  });
});