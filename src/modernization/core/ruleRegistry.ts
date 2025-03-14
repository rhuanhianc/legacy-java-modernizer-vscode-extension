import * as vscode from 'vscode';
import { ModernizationRule } from './modernizationRule';

/**
 * Registro de regras de modernização
 */
export class RuleRegistry {
  private static instance: RuleRegistry;
  private rules: Map<string, ModernizationRule> = new Map();
  private rulesByVersion: Map<number, ModernizationRule[]> = new Map();

  private constructor() {}

  /**
   * Obtém a instância única do registro
   */
  public static getInstance(): RuleRegistry {
    if (!RuleRegistry.instance) {
      RuleRegistry.instance = new RuleRegistry();
    }
    return RuleRegistry.instance;
  }

  /**
   * Registra uma regra
   * @param rule Regra a ser registrada
   */
  public registerRule(rule: ModernizationRule): void {
    // Registrar pelo ID
    this.rules.set(rule.id, rule);
    
    // Registrar por versão
    for (const version of rule.appliesTo) {
      if (!this.rulesByVersion.has(version)) {
        this.rulesByVersion.set(version, []);
      }
      this.rulesByVersion.get(version)!.push(rule);
    }
  }

  /**
   * Registra múltiplas regras
   * @param rules Regras a serem registradas
   */
  public registerRules(rules: ModernizationRule[]): void {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }

  /**
   * Obtém uma regra pelo ID
   * @param id ID da regra
   */
  public getRule(id: string): ModernizationRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Obtém todas as regras registradas
   */
  public getAllRules(): ModernizationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Obtém regras para uma versão específica do Java
   * @param version Versão do Java
   */
  public getRulesForVersion(version: number): ModernizationRule[] {
    return this.rulesByVersion.get(version) || [];
  }

  /**
   * Obtém regras para uma versão alvo do Java (inclui todas as regras até essa versão)
   * @param targetVersion Versão alvo do Java
   */
  public getRulesForTargetVersion(targetVersion: number): ModernizationRule[] {
    const rules: ModernizationRule[] = [];
    
    // Adicionar todas as regras até a versão alvo
    for (const [version, versionRules] of this.rulesByVersion.entries()) {
      if (version <= targetVersion) {
        for (const rule of versionRules) {
          // Verificar se a regra já foi adicionada
          if (!rules.some(r => r.id === rule.id)) {
            // Verificar se a regra está habilitada
            if (rule.isEnabled()) {
              rules.push(rule);
            }
          }
        }
      }
    }
    
    return rules;
  }

  /**
   * Obtém todas as versões do Java suportadas
   */
  public getSupportedVersions(): number[] {
    return Array.from(this.rulesByVersion.keys()).sort((a, b) => a - b);
  }

  /**
   * Limpa o registro
   */
  public clear(): void {
    this.rules.clear();
    this.rulesByVersion.clear();
  }
}