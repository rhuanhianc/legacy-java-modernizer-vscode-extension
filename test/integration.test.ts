import * as vscode from 'vscode';
import { PatternAnalyzer } from '../src/analyzer/patternAnalyzer';
import { Java8Rules } from '../src/modernization/versions/java8/java8Rules';
import { RefactoringProvider } from '../src/refactor/refactoringProvider';

// Helper function to create mock WorkspaceConfiguration
function createMockConfiguration(targetVersion = '8', excludedFiles = [], excludedFolders = []): vscode.WorkspaceConfiguration {
  return {
    get: (key: string, defaultValue?: any) => {
      if (key === 'targetJavaVersion') return targetVersion;
      if (key === 'excludedFiles') return excludedFiles;
      if (key === 'excludedFolders') return excludedFolders;
      if (key === 'enabledRules') return {}; // All rules are enabled by default
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

describe('Comprehensive Integration Tests', () => {
  let analyzer: PatternAnalyzer;
  let refactoringProvider: RefactoringProvider;
  
  beforeAll(() => {
    // Register Java 8 rules
    Java8Rules.register();
    
    // Mock configuration
    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'legacyJavaModernizer') {
        return createMockConfiguration('8');
      }
      return createMockConfiguration();
    });
    
    // Create analyzer and refactoring provider
    analyzer = new PatternAnalyzer();
    analyzer.updateConfiguration();
    refactoringProvider = new RefactoringProvider(analyzer);
  });
  
  test('Real-world Java class with multiple modernization patterns', async () => {
    const complexJavaCode = `
package com.example.app;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Comparator;

/**
 * This class demonstrates multiple modernization opportunities
 */
public class ComplexExample {
    private List<String> items;
    private Map<String, Integer> counts;
    
    public ComplexExample() {
        this.items = new ArrayList<>();
        this.counts = new HashMap<>();
    }
    
    public void processItems() {
        // Anonymous class that could be a lambda
        Runnable processor = new Runnable() {
            @Override
            public void run() {
                System.out.println("Processing items");
            }
        };
        
        // For-each loop that could use streams
        for (String item : items) {
            if (item.length() > 5 && !item.startsWith("test")) {
                counts.put(item, item.length());
            }
        }
        
        // Another anonymous class that could be a lambda
        Comparator<String> comparator = new Comparator<String>() {
            @Override
            public int compare(String s1, String s2) {
                return s1.length() - s2.length();
            }
        };
        
        // Null check that could use Optional
        String firstItem = getFirstItem();
        if (firstItem != null) {
            System.out.println("First item length: " + firstItem.length());
        }
        
        // Another for-each loop with result collection
        List<String> longItems = new ArrayList<>();
        for (String item : items) {
            if (item.length() > 10) {
                longItems.add(item.toUpperCase());
            }
        }
        
        // Process multiple conditions
        if (items != null) {
            for (String item : items) {
                System.out.println(item);
            }
        }
    }
    
    private String getFirstItem() {
        if (items.isEmpty()) {
            return null;
        }
        return items.get(0);
    }
    
    public void sortItems() {
        if (items != null && !items.isEmpty()) {
            // Anonymous class with multiple statements
            Comparator<String> complexComparator = new Comparator<String>() {
                @Override
                public int compare(String s1, String s2) {
                    if (s1 == null) return -1;
                    if (s2 == null) return 1;
                    int lengthDiff = s1.length() - s2.length();
                    if (lengthDiff != 0) return lengthDiff;
                    return s1.compareTo(s2);
                }
            };
            
            // Another candidate for stream conversion
            List<String> sortedItems = new ArrayList<>();
            for (String item : items) {
                String processed = item.trim();
                if (!processed.isEmpty()) {
                    sortedItems.add(processed);
                }
            }
        }
    }
}`;
    
    // Create a mock document
    const document = await vscode.workspace.openTextDocument({
      content: complexJavaCode,
      language: 'java'
    });
    
    const uri = vscode.Uri.file('complex-example.java');
    
    // Analyze the file
    const matches = await analyzer.analyzeFile(uri);
    
    // Log active rules and matches
    console.log(`Analyzing with ${analyzer.rules.length} active rules`);
    analyzer.rules.forEach(rule => {
      console.log(`  - ${rule.id}: ${rule.name}`);
    });
    
    console.log(`Found ${matches.length} modernization opportunities:`);
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.rule.id}`);
    });
    
    // Check that we found matches for each rule type
    expect(matches.length).toBeGreaterThan(0);
    
    // Group matches by rule type
    const matchesByRule = matches.reduce((acc, match) => {
      const ruleId = match.rule.id;
      if (!acc[ruleId]) {
        acc[ruleId] = [];
      }
      acc[ruleId].push(match);
      return acc;
    }, {} as {[key: string]: any[]});
    
    // Assert we have at least one match for each rule type
    expect(matchesByRule['lambda-for-anonymous-class']?.length).toBeGreaterThan(0);
    expect(matchesByRule['for-each-to-stream']?.length).toBeGreaterThan(0);
    expect(matchesByRule['optional-for-null-check']?.length).toBeGreaterThan(0);
    
    // Verify the contents of the matches
    if (matchesByRule['lambda-for-anonymous-class']) {
      const lambdaMatch = matchesByRule['lambda-for-anonymous-class'][0];
      expect(lambdaMatch.matchedText).toContain('new Runnable()');
      expect(lambdaMatch.suggestedReplacement).toContain('->');
    }
    
    if (matchesByRule['for-each-to-stream']) {
      const streamMatch = matchesByRule['for-each-to-stream'][0];
      expect(streamMatch.matchedText).toContain('for (String item : items)');
      expect(streamMatch.suggestedReplacement).toContain('.stream()');
    }
    
    if (matchesByRule['optional-for-null-check']) {
      const optionalMatch = matchesByRule['optional-for-null-check'][0];
      expect(optionalMatch.matchedText).toContain('if (');
      expect(optionalMatch.matchedText).toContain('!= null');
      expect(optionalMatch.suggestedReplacement).toContain('Optional.ofNullable');
    }
    
    // Mock the workspace.applyEdit method
    const applyEditSpy = jest.spyOn(vscode.workspace, 'applyEdit');
    applyEditSpy.mockResolvedValue(true);
    
    // Test applying refactorings
    if (matches.length > 0) {
      // Test individual refactoring
      const success = await refactoringProvider.applyRefactoring(matches[0]);
      expect(success).toBe(true);
      expect(applyEditSpy).toHaveBeenCalled();
      
      // Test applying file refactorings
      const fileSuccess = await refactoringProvider.applyFileRefactorings(uri, matches);
      expect(fileSuccess).toBe(true);
    }
  });
  
  test('Edge cases and complex patterns', async () => {
    const edgeCasesCode = `
package com.example.edgecases;

import java.util.List;
import java.util.ArrayList;
import java.util.function.Consumer;

public class EdgeCases {
    // An anonymous class that should not be converted (multiple methods)
    private Object multiMethodObject = new Object() {
        @Override
        public String toString() {
            return "Custom toString";
        }
        
        public void extraMethod() {
            System.out.println("Extra method");
        }
    };
    
    // A complex nested for-each structure
    public void complexNestedLoops(List<List<String>> nestedList) {
        for (List<String> innerList : nestedList) {
            for (String item : innerList) {
                if (item != null && item.length() > 3) {
                    System.out.println(item);
                }
            }
        }
    }
    
    // A lambda that should not be converted again
    private Runnable alreadyModern = () -> System.out.println("Already modern");
    
    // Complex null check with multiple conditions
    public void complexNullCheck(String value) {
        if (value != null && value.length() > 5) {
            System.out.println(value.toUpperCase());
        }
    }
    
    // Anonymous class with generics
    private Consumer<List<String>> complexConsumer = new Consumer<List<String>>() {
        @Override
        public void accept(List<String> list) {
            for (String item : list) {
                System.out.println(item);
            }
        }
    };
}`;
    
    // Create a mock document
    const document = await vscode.workspace.openTextDocument({
      content: edgeCasesCode,
      language: 'java'
    });
    
    const uri = vscode.Uri.file('edge-cases.java');
    
    // Analyze the file
    const matches = await analyzer.analyzeFile(uri);
    
    console.log(`Found ${matches.length} modernization opportunities in edge cases file:`);
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.rule.id}`);
    });
    
    // Verify that we don't get false positives
    // The multi-method anonymous class should not be converted
    const lambdaMatches = matches.filter(m => m.rule.id === 'lambda-for-anonymous-class');
    lambdaMatches.forEach(match => {
      expect(match.matchedText).not.toContain('multiMethodObject');
    });
    
    // Complex null checks with && should not be converted to Optional
    const optionalMatches = matches.filter(m => m.rule.id === 'optional-for-null-check');
    optionalMatches.forEach(match => {
      expect(match.matchedText).not.toContain('value != null && value.length() > 5');
    });
    
    // The Consumer with generics should be properly converted
    const consumerMatches = lambdaMatches.filter(m => m.matchedText.includes('complexConsumer'));
    if (consumerMatches.length > 0) {
      const consumerMatch = consumerMatches[0];
      expect(consumerMatch.suggestedReplacement).toContain('->');
      expect(consumerMatch.suggestedReplacement).not.toContain('Unexpected token');
    }
  });
});