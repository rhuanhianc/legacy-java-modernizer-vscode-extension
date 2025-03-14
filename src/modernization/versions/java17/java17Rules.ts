import { ModernizationRule } from '../../core/modernizationRule';
import { RuleRegistry } from '../../core/ruleRegistry';
import { SwitchExpressionRule } from './switchExpressionRule';
import { SealedClassesRule } from './sealedClassesRule';

/**
 * Classe para registrar todas as regras do Java 17
 */
export class Java17Rules {
  /**
   * Obtém todas as regras de modernização do Java 17
   */
  public static getRules(): ModernizationRule[] {
    return [
      new SwitchExpressionRule(),
      new SealedClassesRule()
    ];
  }

  /**
   * Registra todas as regras do Java 17 no registro global
   */
  public static register(): void {
    const registry = RuleRegistry.getInstance();
    const rules = Java17Rules.getRules();
    registry.registerRules(rules);
  }
}