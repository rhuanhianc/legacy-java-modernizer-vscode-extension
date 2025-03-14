import * as vscode from 'vscode';
import { 
  ModernizationRule, 
  RuleComplexity, 
  RuleImpact, 
  RuleExample 
} from './modernizationRule';

/**
 * Classe base abstrata para todas as regras de modernização
 */
export abstract class AbstractModernizationRule implements ModernizationRule {
  /**
   * @param id Identificador único da regra
   * @param name Nome amigável da regra
   * @param description Descrição da regra
   * @param introducedVersion Versão do Java onde este recurso foi introduzido
   * @param appliesTo Versões do Java às quais esta regra se aplica
   * @param complexity Complexidade da modernização
   * @param impact Impacto da modernização
   * @param example Exemplo de antes e depois
   */
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly introducedVersion: number,
    public readonly appliesTo: number[],
    public readonly complexity: RuleComplexity,
    public readonly impact: RuleImpact,
    public readonly example: RuleExample
  ) {}

  /**
   * Verifica se um texto contém um padrão que pode ser modernizado
   * @param document Documento a ser analisado
   * @param text Texto a ser analisado
   */
  abstract canModernize(document: vscode.TextDocument, text: string): boolean;

  /**
   * Analisa um documento e retorna os intervalos que podem ser modernizados
   * @param document Documento a ser analisado
   */
  abstract analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]>;

  /**
   * Moderniza um texto específico
   * @param document Documento a ser modernizado
   * @param range Intervalo a ser modernizado
   */
  abstract getModernizedText(document: vscode.TextDocument, range: vscode.Range): string;

  /**
   * Obtém a mensagem de diagnóstico para esta regra
   */
  getDiagnosticMessage(): string {
    return `${this.name}: ${this.description}`;
  }

  /**
   * Verifica se a regra está habilitada nas configurações do usuário
   */
  isEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const enabledRules = config.get<Record<string, boolean>>('enabledRules', {});
    
    // Se não houver configuração específica, assume-se que está habilitada
    if (enabledRules[this.id] === undefined) {
      return true;
    }
    
    return enabledRules[this.id];
  }

  /**
   * Obtém o texto em um determinado intervalo
   * @param document Documento
   * @param range Intervalo
   */
  protected getTextInRange(document: vscode.TextDocument, range: vscode.Range): string {
    return document.getText(range);
  }

  /**
   * Obtém o texto inteiro do documento
   * @param document Documento
   */
  protected getFullText(document: vscode.TextDocument): string {
    return document.getText();
  }

  /**
   * Encontra todas as ocorrências de um regex em um documento
   * @param document Documento
   * @param pattern Padrão regex
   */
  protected findAllMatches(document: vscode.TextDocument, pattern: RegExp): { range: vscode.Range, match: RegExpExecArray }[] {
    const text = this.getFullText(document);
    const results: { range: vscode.Range, match: RegExpExecArray }[] = [];
    
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0; // Reset regex state
    
    while ((match = pattern.exec(text)) !== null) {
      // Calcular a posição no documento
      const startPosition = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length);
      
      results.push({
        range: new vscode.Range(startPosition, endPosition),
        match
      });
      
      // Evitar loops infinitos para expressões regulares que podem corresponder a cadeias vazias
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
    
    return results;
  }
}