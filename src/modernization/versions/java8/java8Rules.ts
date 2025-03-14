import { ModernizationRule } from '../../core/modernizationRule';
import { RuleRegistry } from '../../core/ruleRegistry';
import { LambdaRule } from './lambdaRule';
import { StreamAPIRule } from './streamAPIRule';
import { OptionalRule } from './optionalRule';

/**
 * Classe para registrar todas as regras do Java 8
 */
export class Java8Rules {
  /**
   * Obtém todas as regras de modernização do Java 8
   */
  public static getRules(): ModernizationRule[] {
    return [
      new LambdaRule(),
      new StreamAPIRule(),
      new OptionalRule()
    ];
  }

  /**
   * Registra todas as regras do Java 8 no registro global
   */
  public static register(): void {
    const registry = RuleRegistry.getInstance();
    const rules = Java8Rules.getRules();
    registry.registerRules(rules);
  }
}