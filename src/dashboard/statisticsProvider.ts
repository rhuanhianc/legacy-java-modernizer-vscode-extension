import * as vscode from 'vscode';
import { AnalysisResults } from '../analyzer/patternAnalyzer';
import { ModernizationRule } from '../modernization/core/modernizationRule';
import { RuleRegistry } from '../modernization/core/ruleRegistry';

/**
 * Estatísticas de modernização
 */
export interface ModernizationStatistics {
  totalPatterns: number;
  appliedPatterns: number;
  suggestedPatterns: number;
  fileStatistics: {
    totalFiles: number;
    filesWithPatterns: number;
    filesModernized: number;
  };
  patternTypeStatistics: {
    [ruleId: string]: {
      name: string;
      count: number;
      applied: number;
      description: string;
    }
  };
  impactStatistics: {
    readability: number;
    performance: number;
    maintenance: number;
  };
}

/**
 * Provedor de estatísticas para modernização
 */
export class StatisticsProvider {
  private static readonly STORAGE_KEY = 'legacyJavaModernizer.statistics';
  private statistics: ModernizationStatistics;
  private context: vscode.ExtensionContext;
  private ruleRegistry: RuleRegistry;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.ruleRegistry = RuleRegistry.getInstance();
    this.statistics = this.loadStatistics();
  }
  
  /**
   * Carrega estatísticas do armazenamento da extensão
   */
  private loadStatistics(): ModernizationStatistics {
    const storedStats = this.context.globalState.get<ModernizationStatistics>(
      StatisticsProvider.STORAGE_KEY
    );
    
    if (storedStats) {
      return storedStats;
    }
    
    // Estatísticas iniciais
    return {
      totalPatterns: 0,
      appliedPatterns: 0,
      suggestedPatterns: 0,
      fileStatistics: {
        totalFiles: 0,
        filesWithPatterns: 0,
        filesModernized: 0
      },
      patternTypeStatistics: {},
      impactStatistics: {
        readability: 0,
        performance: 0,
        maintenance: 0
      }
    };
  }
  
  /**
   * Salva estatísticas no armazenamento da extensão
   */
  private saveStatistics(): void {
    this.context.globalState.update(
      StatisticsProvider.STORAGE_KEY,
      this.statistics
    );
  }
  
  /**
   * Atualiza estatísticas com base nos resultados da análise
   * @param results Resultados da análise
   */
  public updateStatistics(results: AnalysisResults): void {
    // Atualizar estatísticas de arquivo
    this.statistics.fileStatistics.totalFiles = results.totalFiles;
    this.statistics.fileStatistics.filesWithPatterns = results.filesWithIssues;
    
    // Atualizar contagens de padrões
    this.statistics.totalPatterns += results.totalPatterns;
    this.statistics.suggestedPatterns = results.totalPatterns;
    
    // Atualizar estatísticas por tipo de padrão
    for (const [patternId, count] of results.statsByPatternType.entries()) {
      if (!this.statistics.patternTypeStatistics[patternId]) {
        // Encontrar a regra para este padrão
        const rule = this.findRuleById(patternId);
        
        if (rule) {
          this.statistics.patternTypeStatistics[patternId] = {
            name: rule.name,
            count,
            applied: 0,
            description: rule.description
          };
        }
      } else {
        this.statistics.patternTypeStatistics[patternId].count = count;
      }
    }
    
    // Atualizar estatísticas de impacto
    this.statistics.impactStatistics = results.impact;
    
    // Salvar estatísticas atualizadas
    this.saveStatistics();
  }
  
  /**
   * Atualiza estatísticas após aplicar refatorações
   * @param appliedCount Número de refatorações aplicadas
   */
  public updateAppliedStatistics(appliedCount: number): void {
    this.statistics.appliedPatterns += appliedCount;
    this.statistics.suggestedPatterns -= appliedCount;
    
    // Incrementar o número de arquivos modernizados
    // Nota: esta é uma estimativa, não temos o número exato
    if (appliedCount > 0) {
      this.statistics.fileStatistics.filesModernized += 1;
    }
    
    // Salvar estatísticas atualizadas
    this.saveStatistics();
  }
  
  /**
   * Encontra uma regra pelo ID
   * @param ruleId ID da regra
   */
  private findRuleById(ruleId: string): ModernizationRule | undefined {
    // Usar o registro de regras para encontrar regra pelo ID
    return this.ruleRegistry.getRule(ruleId);
  }
  
  /**
   * Limpa todas as estatísticas
   */
  public resetStatistics(): void {
    this.statistics = {
      totalPatterns: 0,
      appliedPatterns: 0,
      suggestedPatterns: 0,
      fileStatistics: {
        totalFiles: 0,
        filesWithPatterns: 0,
        filesModernized: 0
      },
      patternTypeStatistics: {},
      impactStatistics: {
        readability: 0,
        performance: 0,
        maintenance: 0
      }
    };
    
    this.saveStatistics();
  }
  
  /**
   * Obtém estatísticas atuais
   */
  public getStatistics(): ModernizationStatistics {
    return this.statistics;
  }
}