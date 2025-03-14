// test/ruleRegistry.test.ts
import { RuleRegistry } from '../../src/modernization/core/ruleRegistry';
import { ModernizationRule, RuleComplexity } from '../../src/modernization/core/modernizationRule';
import * as vscode from 'vscode';

// Mock ModernizationRule implementation for testing
class MockRule implements ModernizationRule {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly introducedVersion: number,
    public readonly appliesTo: number[],
    public readonly enabled: boolean = true
  ) {}

  complexity = RuleComplexity.SIMPLE;
  impact = { readability: 5, performance: 5, maintenance: 5 };
  example = { before: 'before', after: 'after' };

  isEnabled(): boolean {
    return this.enabled;
  }

  canModernize(_document: vscode.TextDocument, _text: string): boolean {
    return true;
  }

  async analyzeDocument(_document: vscode.TextDocument): Promise<vscode.Range[]> {
    return [];
  }

  getModernizedText(_document: vscode.TextDocument, _range: vscode.Range): string {
    return 'modernized';
  }

  getDiagnosticMessage(): string {
    return this.description;
  }
}

describe('RuleRegistry', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    // Clear registry before each test
    registry = RuleRegistry.getInstance();
    registry.clear();
  });

  test('getInstance returns singleton instance', () => {
    const instance1 = RuleRegistry.getInstance();
    const instance2 = RuleRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('registerRule adds a rule to the registry', () => {
    const rule = new MockRule('test-rule', 'Test Rule', 'A test rule', 8, [8, 11]);
    registry.registerRule(rule);
    
    const retrievedRule = registry.getRule('test-rule');
    expect(retrievedRule).toBe(rule);
  });

  test('registerRules adds multiple rules to the registry', () => {
    const rule1 = new MockRule('rule1', 'Rule 1', 'First rule', 8, [8, 11]);
    const rule2 = new MockRule('rule2', 'Rule 2', 'Second rule', 11, [11, 17]);
    
    registry.registerRules([rule1, rule2]);
    
    expect(registry.getRule('rule1')).toBe(rule1);
    expect(registry.getRule('rule2')).toBe(rule2);
  });

  test('getAllRules returns all registered rules', () => {
    const rule1 = new MockRule('rule1', 'Rule 1', 'First rule', 8, [8, 11]);
    const rule2 = new MockRule('rule2', 'Rule 2', 'Second rule', 11, [11, 17]);
    
    registry.registerRules([rule1, rule2]);
    
    const allRules = registry.getAllRules();
    expect(allRules).toHaveLength(2);
    expect(allRules).toContain(rule1);
    expect(allRules).toContain(rule2);
  });

  test('getRulesForVersion returns rules for a specific version', () => {
    const rule1 = new MockRule('rule1', 'Rule 1', 'First rule', 8, [8, 11]);
    const rule2 = new MockRule('rule2', 'Rule 2', 'Second rule', 11, [11, 17]);
    const rule3 = new MockRule('rule3', 'Rule 3', 'Third rule', 8, [8, 11, 17]);
    
    registry.registerRules([rule1, rule2, rule3]);
    
    const rulesForJava11 = registry.getRulesForVersion(11);
    expect(rulesForJava11).toHaveLength(3);
    expect(rulesForJava11).toContain(rule1);
    expect(rulesForJava11).toContain(rule2);
    expect(rulesForJava11).toContain(rule3);
    
    const rulesForJava8 = registry.getRulesForVersion(8);
    expect(rulesForJava8).toHaveLength(2);
    expect(rulesForJava8).toContain(rule1);
    expect(rulesForJava8).toContain(rule3);
  });

  test('getRulesForTargetVersion returns rules up to and including target version', () => {
    const rule1 = new MockRule('rule1', 'Rule 1', 'First rule', 8, [8]);
    const rule2 = new MockRule('rule2', 'Rule 2', 'Second rule', 11, [11]);
    const rule3 = new MockRule('rule3', 'Rule 3', 'Third rule', 17, [17]);
    
    registry.registerRules([rule1, rule2, rule3]);
    
    const rulesForJava8 = registry.getRulesForTargetVersion(8);
    expect(rulesForJava8).toHaveLength(1);
    expect(rulesForJava8).toContain(rule1);
    
    const rulesForJava11 = registry.getRulesForTargetVersion(11);
    expect(rulesForJava11).toHaveLength(2);
    expect(rulesForJava11).toContain(rule1);
    expect(rulesForJava11).toContain(rule2);
    
    const rulesForJava17 = registry.getRulesForTargetVersion(17);
    expect(rulesForJava17).toHaveLength(3);
  });

  test('getRulesForTargetVersion excludes disabled rules', () => {
    const enabledRule = new MockRule('enabled-rule', 'Enabled Rule', 'An enabled rule', 8, [8], true);
    const disabledRule = new MockRule('disabled-rule', 'Disabled Rule', 'A disabled rule', 8, [8], false);
    
    registry.registerRules([enabledRule, disabledRule]);
    
    const rulesForJava8 = registry.getRulesForTargetVersion(8);
    expect(rulesForJava8).toHaveLength(1);
    expect(rulesForJava8).toContain(enabledRule);
    expect(rulesForJava8).not.toContain(disabledRule);
  });

  test('getSupportedVersions returns all supported Java versions', () => {
    const rule1 = new MockRule('rule1', 'Rule 1', 'First rule', 8, [8]);
    const rule2 = new MockRule('rule2', 'Rule 2', 'Second rule', 11, [11]);
    const rule3 = new MockRule('rule3', 'Rule 3', 'Third rule', 17, [17]);
    
    registry.registerRules([rule1, rule2, rule3]);
    
    const supportedVersions = registry.getSupportedVersions();
    expect(supportedVersions).toEqual([8, 11, 17]);
  });

  test('clear removes all rules from the registry', () => {
    const rule = new MockRule('test-rule', 'Test Rule', 'A test rule', 8, [8, 11]);
    registry.registerRule(rule);
    
    expect(registry.getAllRules()).toHaveLength(1);
    
    registry.clear();
    
    expect(registry.getAllRules()).toHaveLength(0);
    expect(registry.getRule('test-rule')).toBeUndefined();
  });
});