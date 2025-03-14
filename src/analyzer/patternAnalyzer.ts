import * as vscode from 'vscode';
import * as path from 'path';
import { ModernizationRule } from '../modernization/core/modernizationRule';
import { RuleRegistry } from '../modernization/core/ruleRegistry';
import { JavaASTParser, PatternMatch } from './javaASTParser';

/**
 * Results of code analysis
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
 * Responsible for analyzing Java code for legacy patterns
 */
export class PatternAnalyzer {
  private parser: JavaASTParser;
  private targetJavaVersion: number;
  public rules: ModernizationRule[];
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
   * Gets the target Java version from settings
   */
  private getTargetJavaVersion(): number {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const version = config.get<string>('targetJavaVersion', '11');
    return parseInt(version, 10);
  }
  
  /**
   * Gets excluded folders from settings
   */
  private getExcludedFolders(): string[] {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<string[]>('excludedFolders', []);
  }
  
  /**
   * Gets excluded files from settings
   */
  private getExcludedFiles(): string[] {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<string[]>('excludedFiles', []);
  }
  
  /**
   * Updates the configuration
   */
  public updateConfiguration(): void {
    console.log("Getting rules for target Java version:", this.getTargetJavaVersion());
    this.targetJavaVersion = this.getTargetJavaVersion();
    this.rules = this.ruleRegistry.getRulesForTargetVersion(this.targetJavaVersion);
    this.excludedFolders = this.getExcludedFolders();
    this.excludedFiles = this.getExcludedFiles();
    
    console.log(`Found ${this.rules.length} rules applicable for Java ${this.targetJavaVersion}`);
  }
  
  /**
   * Checks if a file should be excluded from analysis
   * @param filePath File path
   */
  private isExcluded(filePath: string): boolean {
    // Check excluded files
    if (this.excludedFiles.some(excluded => filePath.includes(excluded))) {
      return true;
    }
    
    // Check excluded folders
    return this.excludedFolders.some(folder => filePath.includes(folder));
  }
  
  /**
   * Analyzes a complete workspace for legacy patterns
   * @param progressCallback Callback to update progress
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
    
    console.log(`Analyzing ${totalFiles} Java files in workspace`);
    
    for (const file of javaFiles) {
      // Skip excluded files
      if (this.isExcluded(file.fsPath)) {
        console.log(`Skipping excluded file: ${file.fsPath}`);
        continue;
      }
      
      analyzedFiles++;
      
      if (progressCallback) {
        progressCallback(`Analyzing ${path.basename(file.fsPath)}`, 1 / totalFiles * 100);
      }
      
      const fileMatches = await this.analyzeFile(file);
      console.log(`Found ${fileMatches.length} matches in ${file.fsPath}`);
      
      if (fileMatches.length > 0) {
        filesWithIssues++;
        allMatches.push(...fileMatches);
        statsByFile.set(file.fsPath, fileMatches.length);
        
        // Update statistics by pattern type and impact
        for (const match of fileMatches) {
          const patternId = match.rule.id;
          const currentCount = statsByPatternType.get(patternId) || 0;
          statsByPatternType.set(patternId, currentCount + 1);
          
          // Accumulate impact
          totalImpact.readability += match.rule.impact.readability;
          totalImpact.performance += match.rule.impact.performance;
          totalImpact.maintenance += match.rule.impact.maintenance;
        }
      }
    }
    
    // Normalize impact
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
   * Analyzes a single file for legacy patterns
   * @param fileUri URI of the file to analyze
   */
  public async analyzeFile(fileUri: vscode.Uri): Promise<PatternMatch[]> {
    if (this.isExcluded(fileUri.fsPath)) {
      console.log(`Skipping excluded file: ${fileUri.fsPath}`);
      return [];
    }
    
    // Use registered rules to analyze the file
    const allMatches: PatternMatch[] = [];
    
    try {
      console.log(`Analyzing file: ${fileUri.fsPath} with ${this.rules.length} rules`);
      
      const document = await vscode.workspace.openTextDocument(fileUri);
      
      for (const rule of this.rules) {
        if (rule.isEnabled()) {
          try {
            console.log(`Applying rule ${rule.id} to ${fileUri.fsPath}`);
            
            // Use the rule to analyze the document
            const ranges = await rule.analyzeDocument(document);
            console.log(`  - Found ${ranges.length} matches for rule ${rule.id}`);
            
            for (const range of ranges) {
              const matchedText = document.getText(range);
              const suggestedReplacement = rule.getModernizedText(document, range);
              
              // Only add valid matches where the replacement is different from the original
              if (suggestedReplacement && suggestedReplacement !== matchedText) {
                // Create PatternMatch object
                const match: PatternMatch = {
                  rule,
                  file: fileUri,
                  range,
                  matchedText,
                  suggestedReplacement
                };
                
                allMatches.push(match);
                console.log(`  - Added match: ${rule.id}`);
              }
            }
          } catch (error) {
            console.error(`Error applying rule ${rule.id}:`, error);
          }
        } else {
          console.log(`Rule ${rule.id} is disabled, skipping`);
        }
      }
      
      console.log(`Analysis complete for ${fileUri.fsPath}, found ${allMatches.length} matches`);
    } catch (error) {
      console.error(`Error analyzing file ${fileUri.fsPath}:`, error);
    }
    
    return allMatches;
  }

  /**
   * Analyzes specific paths selected by the user
   * @param selectedPaths Paths selected for analysis
   * @param progressCallback Callback to update progress
   */
  public async analyzeSelectedPaths(
    selectedPaths: string[],
    progressCallback?: (message: string, increment: number) => void
  ): Promise<AnalysisResults> {
    console.log(`Analyzing ${selectedPaths.length} selected paths`);
    
    // Find all Java files in selected paths
    const javaFiles: vscode.Uri[] = [];
    
    for (const selectedPath of selectedPaths) {
      try {
        const pathUri = vscode.Uri.file(selectedPath);
        const stat = await vscode.workspace.fs.stat(pathUri);
        
        if (stat.type === vscode.FileType.Directory) {
          // It's a folder, find Java files inside it
          const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(selectedPath, '**/*.java'),
            '**/node_modules/**'
          );
          javaFiles.push(...files);
        } else if (stat.type === vscode.FileType.File && selectedPath.endsWith('.java')) {
          // It's a Java file
          javaFiles.push(pathUri);
        }
      } catch (error) {
        console.error(`Error accessing path ${selectedPath}:`, error);
      }
    }
    
    // Remove duplicates
    const uniqueJavaFiles = Array.from(new Set(javaFiles.map(f => f.toString())))
      .map(uri => vscode.Uri.parse(uri));
    
    console.log(`Found ${uniqueJavaFiles.length} unique Java files in selected paths`);
    
    const totalFiles = uniqueJavaFiles.length;
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
    
    for (const file of uniqueJavaFiles) {
      // Skip excluded files
      if (this.isExcluded(file.fsPath)) {
        continue;
      }
      
      analyzedFiles++;
      
      if (progressCallback) {
        progressCallback(`Analyzing ${path.basename(file.fsPath)}`, 1 / totalFiles * 100);
      }
      
      const fileMatches = await this.analyzeFile(file);
      
      if (fileMatches.length > 0) {
        filesWithIssues++;
        allMatches.push(...fileMatches);
        statsByFile.set(file.fsPath, fileMatches.length);
        
        // Update statistics by pattern type and impact
        for (const match of fileMatches) {
          const patternId = match.rule.id;
          const currentCount = statsByPatternType.get(patternId) || 0;
          statsByPatternType.set(patternId, currentCount + 1);
          
          // Accumulate impact
          totalImpact.readability += match.rule.impact.readability;
          totalImpact.performance += match.rule.impact.performance;
          totalImpact.maintenance += match.rule.impact.maintenance;
        }
      }
    }
    
    // Normalize impact
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
}