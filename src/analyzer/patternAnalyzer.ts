import * as vscode from 'vscode';
import * as path from 'path';
import { ModernizationRule } from '../modernization/core/modernizationRule';
import { RuleRegistry } from '../modernization/core/ruleRegistry';
import { JavaASTParser, PatternMatch } from './javaASTParser';

/**
 * Resultados da análise de código
 */
export interface AnalysisResults {
  matches: PatternMatch[];
  totalFiles: number;
  analyzedFiles: number;
  filesWithIssues: number;
  totalPatterns: number;
  statsByPatternType: Map<string, number>;
  statsByFile: Map<string, number>;
  impact: {
    readability: number;
    performance: number;
    maintenance: number;
  };
}

/**
 * Responsável por analisar o código Java em busca de padrões legados
 */
export class PatternAnalyzer {
  private parser: JavaASTParser;
  private targetJavaVersion: number;
  private rules: ModernizationRule[];
  private excludedFolders: string[];
  private excludedFiles: string[];
  private ruleRegistry: RuleRegistry;
  
  constructor() {
    this.parser = new JavaASTParser();
    this.ruleRegistry = RuleRegistry.getInstance();
    this.targetJavaVersion = this.getTargetJavaVersion();
    this.rules = this.ruleRegistry.getRulesForTargetVersion(this.targetJavaVersion);
    this.excludedFolders = this.getExcludedFolders();
    this.excludedFiles = this.getExcludedFiles();
  }
  
  /**
   * Obtém a versão alvo do Java das configurações
   */
  private getTargetJavaVersion(): number {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const version = config.get<string>('targetJavaVersion', '11');
    return parseInt(version, 10);
  }
  
  /**
   * Obtém as pastas excluídas das configurações
   */
  private getExcludedFolders(): string[] {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<string[]>('excludedFolders', []);
  }
  
  /**
   * Obtém os arquivos excluídos das configurações
   */
  private getExcludedFiles(): string[] {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<string[]>('excludedFiles', []);
  }
  
  /**
   * Atualiza as configurações
   */
  public updateConfiguration(): void {
    this.targetJavaVersion = this.getTargetJavaVersion();
    this.rules = this.ruleRegistry.getRulesForTargetVersion(this.targetJavaVersion);
    this.excludedFolders = this.getExcludedFolders();
    this.excludedFiles = this.getExcludedFiles();
  }
  
  /**
   * Verifica se um arquivo deve ser excluído da análise
   * @param filePath Caminho do arquivo
   */
  private isExcluded(filePath: string): boolean {
    // Verificar arquivos excluídos
    if (this.excludedFiles.some(excluded => filePath.includes(excluded))) {
      return true;
    }
    
    // Verificar pastas excluídas
    return this.excludedFolders.some(folder => filePath.includes(folder));
  }
  
  /**
   * Analisa um workspace completo em busca de padrões legados
   * @param progressCallback Callback para atualizar o progresso
   */
  public async analyzeWorkspace(
    progressCallback?: (message: string, increment: number) => void
  ): Promise<AnalysisResults> {
    const javaFiles = await vscode.workspace.findFiles(
      '**/*.java',
      '**/node_modules/**'
    );
    
    const totalFiles = javaFiles.length;
    let analyzedFiles = 0;
    let filesWithIssues = 0;
    const allMatches: PatternMatch[] = [];
    const statsByPatternType = new Map<string, number>();
    const statsByFile = new Map<string, number>();
    
    let totalImpact = {
      readability: 0,
      performance: 0,
      maintenance: 0
    };
    
    for (const file of javaFiles) {
      // Pular arquivos excluídos
      if (this.isExcluded(file.fsPath)) {
        continue;
      }
      
      analyzedFiles++;
      
      if (progressCallback) {
        progressCallback(`Analisando ${path.basename(file.fsPath)}`, 1 / totalFiles * 100);
      }
      
      const fileMatches = await this.analyzeFile(file);
      
      if (fileMatches.length > 0) {
        filesWithIssues++;
        allMatches.push(...fileMatches);
        statsByFile.set(file.fsPath, fileMatches.length);
        
        // Atualizar estatísticas por tipo de padrão e impacto
        for (const match of fileMatches) {
          const patternId = match.rule.id;
          const currentCount = statsByPatternType.get(patternId) || 0;
          statsByPatternType.set(patternId, currentCount + 1);
          
          // Acumular impacto
          totalImpact.readability += match.rule.impact.readability;
          totalImpact.performance += match.rule.impact.performance;
          totalImpact.maintenance += match.rule.impact.maintenance;
        }
      }
    }
    
    // Normalizar o impacto
    const totalPatterns = allMatches.length;
    if (totalPatterns > 0) {
      totalImpact.readability /= totalPatterns;
      totalImpact.performance /= totalPatterns;
      totalImpact.maintenance /= totalPatterns;
    }
    
    return {
      matches: allMatches,
      totalFiles,
      analyzedFiles,
      filesWithIssues,
      totalPatterns,
      statsByPatternType,
      statsByFile,
      impact: totalImpact
    };
  }
  
  /**
   * Analisa um único arquivo em busca de padrões legados
   * @param fileUri URI do arquivo a ser analisado
   */
  public async analyzeFile(fileUri: vscode.Uri): Promise<PatternMatch[]> {
    if (this.isExcluded(fileUri.fsPath)) {
      return [];
    }
    
    // Usar as regras registradas para analisar o arquivo
    const allMatches: PatternMatch[] = [];
    const document = await vscode.workspace.openTextDocument(fileUri);
    
    for (const rule of this.rules) {
      if (rule.isEnabled()) {
        try {
          // Usar o novo formato de regra para analisar o documento
          const ranges = await rule.analyzeDocument(document);
          
          for (const range of ranges) {
            const matchedText = document.getText(range);
            const suggestedReplacement = rule.getModernizedText(document, range);
            
            // Criar o objeto PatternMatch
            const match: PatternMatch = {
              rule,
              file: fileUri,
              range,
              matchedText,
              suggestedReplacement
            };
            
            allMatches.push(match);
          }
        } catch (error) {
          console.error(`Erro ao aplicar regra ${rule.id}:`, error);
        }
      }
    }
    
    return allMatches;
  }
}