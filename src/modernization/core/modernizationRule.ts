import * as vscode from 'vscode';

/**
 * Representa o nível de complexidade de uma regra de modernização
 */
export enum RuleComplexity {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  COMPLEX = 'complex'
}

/**
 * Representa o impacto de uma regra de modernização
 */
export interface RuleImpact {
  readability: number;  // 1-10
  performance: number;  // 1-10
  maintenance: number;  // 1-10
}

/**
 * Representa um exemplo de antes e depois para uma regra
 */
export interface RuleExample {
  before: string;
  after: string;
}

/**
 * Interface base para todas as regras de modernização
 */
export interface ModernizationRule {
  /**
   * Identificador único da regra
   */
  id: string;

  /**
   * Nome amigável da regra
   */
  name: string;

  /**
   * Descrição da regra
   */
  description: string;

  /**
   * Versão do Java onde este recurso foi introduzido
   */
  introducedVersion: number;

  /**
   * Versões do Java às quais esta regra se aplica
   */
  appliesTo: number[];

  /**
   * Complexidade da modernização
   */
  complexity: RuleComplexity;

  /**
   * Impacto da modernização
   */
  impact: RuleImpact;

  /**
   * Exemplo de antes e depois
   */
  example: RuleExample;

  /**
   * Verifica se um texto contém um padrão que pode ser modernizado
   * @param document Documento a ser analisado
   * @param text Texto a ser analisado
   * @returns true se o texto contém um padrão que pode ser modernizado
   */
  canModernize(document: vscode.TextDocument, text: string): boolean;

  /**
   * Analisa um documento e retorna os intervalos que podem ser modernizados
   * @param document Documento a ser analisado
   * @returns Lista de intervalos que podem ser modernizados
   */
  analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]>;

  /**
   * Moderniza um texto específico
   * @param document Documento a ser modernizado
   * @param range Intervalo a ser modernizado
   * @returns Texto modernizado
   */
  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string;

  /**
   * Obtém a mensagem de diagnóstico para esta regra
   * @returns Mensagem de diagnóstico
   */
  getDiagnosticMessage(): string;

  /**
   * Verifica se a regra está habilitada nas configurações do usuário
   * @returns true se a regra estiver habilitada
   */
  isEnabled(): boolean;
}