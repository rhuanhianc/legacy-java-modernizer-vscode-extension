import * as vscode from 'vscode';

/**
 * Gerenciador de configuração da extensão
 */
export class Configuration {
  private static instance: Configuration;
  
  private constructor() {}
  
  /**
   * Obtém a instância única do gerenciador de configuração
   */
  public static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }
  
  /**
   * Obtém a versão alvo do Java
   */
  public getTargetJavaVersion(): number {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const version = config.get<string>('targetJavaVersion', '11');
    return parseInt(version, 10);
  }
  
  /**
   * Define a versão alvo do Java
   * @param version Versão alvo do Java
   */
  public async setTargetJavaVersion(version: number | string): Promise<void> {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return await config.update('targetJavaVersion', version.toString(), vscode.ConfigurationTarget.Workspace);
  }
  
  /**
   * Verifica se as sugestões automáticas estão habilitadas
   */
  public isAutomaticSuggestionsEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<boolean>('enableAutomaticSuggestions', true);
  }
  
  /**
   * Obtém as pastas excluídas
   */
  public getExcludedFolders(): string[] {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<string[]>('excludedFolders', []);
  }
  
  /**
   * Adiciona uma pasta à lista de exclusões
   * @param folder Pasta a ser excluída
   */
  public async addExcludedFolder(folder: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFolders = config.get<string[]>('excludedFolders', []);
    
    if (!excludedFolders.includes(folder)) {
      excludedFolders.push(folder);
      await config.update('excludedFolders', excludedFolders, vscode.ConfigurationTarget.Workspace);
    }
  }
  
  /**
   * Remove uma pasta da lista de exclusões
   * @param folder Pasta a ser incluída
   */
  public async removeExcludedFolder(folder: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFolders = config.get<string[]>('excludedFolders', []);
    
    const index = excludedFolders.indexOf(folder);
    if (index !== -1) {
      excludedFolders.splice(index, 1);
      await config.update('excludedFolders', excludedFolders, vscode.ConfigurationTarget.Workspace);
    }
  }
  
  /**
   * Obtém os arquivos excluídos
   */
  public getExcludedFiles(): string[] {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<string[]>('excludedFiles', []);
  }
  
  /**
   * Adiciona um arquivo à lista de exclusões
   * @param file Arquivo a ser excluído
   */
  public async addExcludedFile(file: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFiles = config.get<string[]>('excludedFiles', []);
    
    if (!excludedFiles.includes(file)) {
      excludedFiles.push(file);
      await config.update('excludedFiles', excludedFiles, vscode.ConfigurationTarget.Workspace);
    }
  }
  
  /**
   * Remove um arquivo da lista de exclusões
   * @param file Arquivo a ser incluído
   */
  public async removeExcludedFile(file: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const excludedFiles = config.get<string[]>('excludedFiles', []);
    
    const index = excludedFiles.indexOf(file);
    if (index !== -1) {
      excludedFiles.splice(index, 1);
      await config.update('excludedFiles', excludedFiles, vscode.ConfigurationTarget.Workspace);
    }
  }
  
  /**
   * Verifica se o cálculo de métricas está habilitado
   */
  public isMetricsEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<boolean>('modernizationMetricsEnabled', true);
  }
  
  /**
   * Verifica se uma regra específica está habilitada
   * @param ruleId ID da regra
   */
  public isRuleEnabled(ruleId: string): boolean {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const enabledRules = config.get<Record<string, boolean>>('enabledRules', {});
    
    // Se não houver configuração específica, assume-se que está habilitada
    if (enabledRules[ruleId] === undefined) {
      return true;
    }
    
    return enabledRules[ruleId];
  }
  
  /**
   * Habilita ou desabilita uma regra
   * @param ruleId ID da regra
   * @param enabled Estado da regra (habilitada ou desabilitada)
   */
  public async setRuleEnabled(ruleId: string, enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const enabledRules = config.get<Record<string, boolean>>('enabledRules', {});
    
    enabledRules[ruleId] = enabled;
    await config.update('enabledRules', enabledRules, vscode.ConfigurationTarget.Workspace);
  }
  
  /**
   * Verifica se uma visualização específica está habilitada
   * @param viewId ID da visualização
   */
  public isViewEnabled(viewId: string): boolean {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    return config.get<boolean>(`show${viewId}`, true);
  }
  
  /**
   * Habilita ou desabilita uma visualização
   * @param viewId ID da visualização
   * @param enabled Estado da visualização (habilitada ou desabilitada)
   */
  public async setViewEnabled(viewId: string, enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    await config.update(`show${viewId}`, enabled, vscode.ConfigurationTarget.Workspace);
  }
}