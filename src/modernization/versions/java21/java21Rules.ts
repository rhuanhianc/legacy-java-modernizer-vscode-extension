import { ModernizationRule } from '../../core/modernizationRule';
import { RuleRegistry } from '../../core/ruleRegistry';
import { PatternMatchingRule } from './patternMatchingRule';
import { RecordRule } from './recordRule';

/**
 * Classe para registrar todas as regras do Java 21
 */
export class Java21Rules {
  /**
   * Obtém todas as regras de modernização do Java 21
   */
  public static getRules(): ModernizationRule[] {
    return [
      new PatternMatchingRule(),
      new RecordRule()
    ];
  }

  /**
   * Registra todas as regras do Java 21 no registro global
   */
  public static register(): void {
    const registry = RuleRegistry.getInstance();
    const rules = Java21Rules.getRules();
    registry.registerRules(rules);
  }
}