// test/patternAnalyzer.test.ts
import * as vscode from 'vscode';
import { PatternAnalyzer } from '../../src/analyzer/patternAnalyzer';
import { RuleRegistry } from '../../src/modernization/core/ruleRegistry';
import { ModernizationRule, RuleComplexity } from '../../src/modernization/core/modernizationRule';

// Função auxiliar para criar mock do WorkspaceConfiguration
function createMockConfiguration(targetVersion: string = '8', excludedFiles: string[] = [], excludedFolders: string[] = []): vscode.WorkspaceConfiguration {
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

// Mock rule for testing
class MockRule implements ModernizationRule {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly introducedVersion: number,
    public readonly appliesTo: number[],
    public readonly shouldMatch: boolean = true
  ) {}

  complexity = RuleComplexity.SIMPLE;
  impact = { readability: 5, performance: 5, maintenance: 5 };
  example = { before: 'before', after: 'after' };

  isEnabled(): boolean {
    return true;
  }

  canModernize(_document: vscode.TextDocument, _text: string): boolean {
    return this.shouldMatch;
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    if (!this.shouldMatch) return [];
    
    // Return a mock range if this rule should match
    return [new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(1, 0)
    )];
  }

  getModernizedText(_document: vscode.TextDocument, _range: vscode.Range): string {
    return 'modernized text';
  }

  getDiagnosticMessage(): string {
    return this.description;
  }
}

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;
  let registry: RuleRegistry;
  
  beforeEach(() => {
    // Reset registry
    registry = RuleRegistry.getInstance();
    registry.clear();
    
    // Create analyzer
    analyzer = new PatternAnalyzer();
  });
  
  test('should filter rules based on target Java version', async () => {
    // Register rules for different Java versions
    const java8Rule = new MockRule('java8-rule', 'Java 8 Rule', 'Rule for Java 8', 8, [8]);
    const java11Rule = new MockRule('java11-rule', 'Java 11 Rule', 'Rule for Java 11', 11, [11]);
    const java17Rule = new MockRule('java17-rule', 'Java 17 Rule', 'Rule for Java 17', 17, [17]);
    
    registry.registerRules([java8Rule, java11Rule, java17Rule]);
    
    // Mock configuration to target Java 8
    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'legacyJavaModernizer') {
        return createMockConfiguration('8');
      }
      return createMockConfiguration();
    });
    
    // Update configuration to apply new target version
    analyzer.updateConfiguration();
    
    // Analyze a Java file
    const mockDocument = await vscode.workspace.openTextDocument({
      content: 'public class Test {}',
      language: 'java'
    });
    
    const matches = await analyzer.analyzeFile(vscode.Uri.file('test.java'));
    
    // Only Java 8 rule should match
    expect(matches.length).toBe(1);
    expect(matches[0].rule.id).toBe('java8-rule');
  });
  
  test('should respect excluded files', async () => {
    // Register a rule that matches everything
    const alwaysMatchRule = new MockRule('always-match', 'Always Match', 'This rule always matches', 8, [8, 11, 17]);
    registry.registerRule(alwaysMatchRule);
    
    // Mock configuration to exclude a specific file
    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'legacyJavaModernizer') {
        return createMockConfiguration('8', ['excluded.java']);
      }
      return createMockConfiguration();
    });
    
    // Update configuration to apply new exclusions
    analyzer.updateConfiguration();
    
    // Test with non-excluded file
    const includeMatches = await analyzer.analyzeFile(vscode.Uri.file('included.java'));
    expect(includeMatches.length).toBe(1);
    
    // Test with excluded file
    const excludeMatches = await analyzer.analyzeFile(vscode.Uri.file('excluded.java'));
    expect(excludeMatches.length).toBe(0);
  });
  
  test('should respect excluded folders', async () => {
    // Register a rule that matches everything
    const alwaysMatchRule = new MockRule('always-match', 'Always Match', 'This rule always matches', 8, [8, 11, 17]);
    registry.registerRule(alwaysMatchRule);
    
    // Mock configuration to exclude a specific folder
    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'legacyJavaModernizer') {
        return createMockConfiguration('8', [], ['excluded-folder']);
      }
      return createMockConfiguration();
    });
    
    // Update configuration to apply new exclusions
    analyzer.updateConfiguration();
    
    // Test with file in non-excluded folder
    const includeMatches = await analyzer.analyzeFile(vscode.Uri.file('included-folder/test.java'));
    expect(includeMatches.length).toBe(1);
    
    // Test with file in excluded folder
    const excludeMatches = await analyzer.analyzeFile(vscode.Uri.file('excluded-folder/test.java'));
    expect(excludeMatches.length).toBe(0);
  });
  
  test('should analyze entire workspace and return correct statistics', async () => {
    // Register rules that match or don't match
    const matchingRule = new MockRule('matching-rule', 'Matching Rule', 'Rule that matches', 8, [8], true);
    const nonMatchingRule = new MockRule('non-matching-rule', 'Non-Matching Rule', 'Rule that doesn\'t match', 8, [8], false);
    
    registry.registerRules([matchingRule, nonMatchingRule]);
    
    // Mock findFiles to return some test files
    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([
      vscode.Uri.file('file1.java'),
      vscode.Uri.file('file2.java'),
      vscode.Uri.file('file3.java')
    ]);
    
    // Mock configuration to not exclude any files
    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'legacyJavaModernizer') {
        return createMockConfiguration('8', [], []);
      }
      return createMockConfiguration();
    });
    
    // Update configuration
    analyzer.updateConfiguration();
    
    // Analyze workspace
    const results = await analyzer.analyzeWorkspace();
    
    // Validate results
    expect(results.totalFiles).toBe(3); // 3 files found
    expect(results.analyzedFiles).toBe(3); // All 3 files analyzed
    expect(results.filesWithIssues).toBe(3); // All files have issues
    expect(results.totalPatterns).toBe(3); // 3 matches (1 per file)
    
    // Check statistics by pattern type
    expect(results.statsByPatternType.size).toBe(1);
    expect(results.statsByPatternType.get('matching-rule')).toBe(3);
    
    // Check statistics by file
    expect(results.statsByFile.size).toBe(3);
    results.statsByFile.forEach((count) => {
      expect(count).toBe(1); // Each file has 1 match
    });
    
    // Check impact metrics
    expect(results.impact.readability).toBe(5);
    expect(results.impact.performance).toBe(5);
    expect(results.impact.maintenance).toBe(5);
  });
});