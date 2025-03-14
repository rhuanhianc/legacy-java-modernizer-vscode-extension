import { ModernizationRule } from '../../core/modernizationRule';
import { RuleRegistry } from '../../core/ruleRegistry';
import { VarRule } from './varRule';
import { StringAPIRule } from './stringAPIRule';

/**
 * Classe para registrar todas as regras do Java 11
 */
export class Java11Rules {
  /**
   * Obtém todas as regras de modernização do Java 11
   */
  public static getRules(): ModernizationRule[] {
    return [
      new VarRule(),
      new StringAPIRule()
    ];
  }

  /**
   * Registra todas as regras do Java 11 no registro global
   */
  public static register(): void {
    const registry = RuleRegistry.getInstance();
    const rules = Java11Rules.getRules();
    registry.registerRules(rules);
  }
}