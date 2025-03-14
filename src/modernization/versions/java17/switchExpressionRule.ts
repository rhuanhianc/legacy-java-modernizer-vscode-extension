import * as vscode from 'vscode';
import { AbstractModernizationRule } from '../../core/abstractModernizationRule';
import { RuleComplexity } from '../../core/modernizationRule';

/**
 * Regra para converter instruções switch tradicionais para expressões switch
 * Versão melhorada com análise de contexto e validação mais precisa
 */
export class SwitchExpressionRule extends AbstractModernizationRule {
  constructor() {
    super(
      'switch-expression',
      'Expressões Switch',
      'Converte instruções switch tradicionais para expressões switch, tornando o código mais conciso e legível',
      17,
      [17, 21],
      RuleComplexity.MEDIUM,
      {
        readability: 9,
        performance: 5,
        maintenance: 8
      },
      {
        before: `String result;\nswitch (day) {\n  case MONDAY: result = "Work";\n    break;\n  case SATURDAY:\n  case SUNDAY: result = "Weekend";\n    break;\n  default: result = "Work";\n    break;\n}`,
        after: `String result = switch (day) {\n  case MONDAY -> "Work";\n  case SATURDAY, SUNDAY -> "Weekend";\n  default -> "Work";\n};`
      }
    );
  }

  /**
   * Padrão para detectar switches que podem ser convertidos em expressões switch
   * Versão melhorada com captura de grupos mais precisa
   */
  private getSwitchPattern(): RegExp {
    return /(\w+)\s+(\w+)\s*=\s*[^;]*;\s*switch\s*\(\s*(\w+)\s*\)\s*\{([^}]*)\}/gs;
  }

  /**
   * Padrão alternativo para detectar switches com retorno imediato
   * Versão melhorada para capturar o context corretamente
   */
  private getReturnSwitchPattern(): RegExp {
    return /(?:return\s+)?switch\s*\(\s*(\w+)\s*\)\s*\{([^}]*?(?:\s*case\s+[^:]+:\s*return\s+[^;]+;)[^}]*)\}/gs;
  }

  canModernize(document: vscode.TextDocument, text: string): boolean {
    const pattern1 = this.getSwitchPattern();
    const pattern2 = this.getReturnSwitchPattern();
    pattern1.lastIndex = 0;
    pattern2.lastIndex = 0;
    return pattern1.test(text) || pattern2.test(text);
  }

  async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Range[]> {
    const pattern1 = this.getSwitchPattern();
    const pattern2 = this.getReturnSwitchPattern();
    
    const matches1 = this.findAllMatches(document, pattern1);
    const matches2 = this.findAllMatches(document, pattern2);
    
    // Filtrar para incluir apenas switches que podem ser convertidos
    const validMatches1 = matches1.filter(m => {
      const [_, type, varName, switchVar, body] = m.match;
      return this.isSwitchConvertible(body, varName);
    });
    
    const validMatches2 = matches2.filter(m => {
      const [_, switchVar, body] = m.match;
      return this.isReturnSwitchConvertible(body);
    });
    
    return [...validMatches1, ...validMatches2].map(m => m.range);
  }

  /**
   * Verifica se um switch com atribuição pode ser convertido para expressão switch
   * Melhorado com validação de padrões mais precisa
   * @param body Corpo do switch
   * @param varName Nome da variável atribuída
   */
  private isSwitchConvertible(body: string, varName: string): boolean {
    // Verificar se cada case apenas atribui valor à variável e faz break
    const casePattern = /case\s+([^:]+):\s*(\w+)\s*=\s*([^;]+);(?:\s*break;)?/g;
    
    // Extrair todos os cases
    const cases: Array<{ labels: string, assignedVar: string, value: string }> = [];
    
    let match;
    while ((match = casePattern.exec(body)) !== null) {
      const [_, labels, assignedVar, value] = match;
      
      // Verificar se a variável atribuída é a mesma do padrão
      if (assignedVar !== varName) {
        return false;
      }
      
      cases.push({ labels, assignedVar, value });
    }
    
    // Verificar se há um caso default
    const defaultMatch = /default:\s*(\w+)\s*=\s*([^;]+);(?:\s*break;)?/.exec(body);
    if (!defaultMatch) {
      // Expressões switch geralmente precisam de um caso default
      return false;
    }
    
    // A variável do default também deve ser a mesma
    if (defaultMatch[1] !== varName) {
      return false;
    }
    
    // Deve haver pelo menos um case
    return cases.length > 0;
  }

  /**
   * Verifica se um switch com return pode ser convertido para expressão switch
   * Melhorado com validação de padrões mais precisa
   * @param body Corpo do switch
   */
  private isReturnSwitchConvertible(body: string): boolean {
    // Verificar se cada case apenas retorna um valor
    const casePattern = /case\s+([^:]+):\s*return\s+([^;]+);/g;
    
    // Extrair todos os cases
    const cases: Array<{ labels: string, value: string }> = [];
    
    let match;
    while ((match = casePattern.exec(body)) !== null) {
      const [_, labels, value] = match;
      cases.push({ labels, value });
    }
    
    // Verificar se há um caso default
    const defaultMatch = /default:\s*return\s+([^;]+);/.exec(body);
    if (!defaultMatch) {
      // Expressões switch geralmente precisam de um caso default
      return false;
    }
    
    // Deve haver pelo menos um case e ter um default
    return cases.length > 0 && defaultMatch !== null;
  }

  getModernizedText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText(range);
    
    // Tentar converter switch com atribuição
    const pattern1 = this.getSwitchPattern();
    if (pattern1.test(text)) {
      return this.convertAssignmentSwitch(text);
    }
    
    // Tentar converter switch com return
    const pattern2 = this.getReturnSwitchPattern();
    return this.convertReturnSwitch(text);
  }

  /**
   * Converte um switch com atribuição para expressão switch
   * Melhorado para lidar com casos agrupados e formatação consistente
   * @param text Texto a ser convertido
   */
  private convertAssignmentSwitch(text: string): string {
    const pattern = this.getSwitchPattern();
    pattern.lastIndex = 0;
    
    return text.replace(pattern, (match, type, varName, switchVar, body) => {
      // Extrair casos do switch
      const switchCases: Array<{ labels: string[], value: string }> = [];
      const lines = body.split('\n');
      let currentLabels: string[] = [];
      let currentValue = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Ignorar linhas vazias
        if (line === '') {
          continue;
        }
        
        // Captura de case
        const caseMatch = line.match(/case\s+([^:]+):/);
        if (caseMatch) {
          // Se já temos etiquetas e valor, adicionar o caso atual
          if (currentLabels.length > 0 && currentValue !== '') {
            switchCases.push({
              labels: [...currentLabels],
              value: currentValue
            });
            currentLabels = [];
            currentValue = '';
          }
          
          // Guardar o label atual
          currentLabels.push(caseMatch[1].trim());
          continue;
        }
        
        // Captura de default
        const defaultMatch = line.match(/default:/);
        if (defaultMatch) {
          // Se já temos etiquetas e valor, adicionar o caso atual
          if (currentLabels.length > 0 && currentValue !== '') {
            switchCases.push({
              labels: [...currentLabels],
              value: currentValue
            });
            currentLabels = [];
            currentValue = '';
          }
          
          currentLabels = ['default'];
          continue;
        }
        
        // Captura de atribuição
        const assignMatch = line.match(/(\w+)\s*=\s*([^;]+);/);
        if (assignMatch && assignMatch[1] === varName) {
          currentValue = assignMatch[2].trim();
          
          // Se a próxima linha for break ou fim do switch, adicionar o caso
          const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
          if (nextLine === 'break;' || nextLine === '}' || nextLine === '' || nextLine.startsWith('case') || nextLine.startsWith('default')) {
            i += nextLine === 'break;' ? 1 : 0; // Pular a linha de break
            
            switchCases.push({
              labels: [...currentLabels],
              value: currentValue
            });
            currentLabels = [];
            currentValue = '';
          }
        }
      }
      
      // Adicionar o último caso se houver
      if (currentLabels.length > 0 && currentValue !== '') {
        switchCases.push({
          labels: [...currentLabels],
          value: currentValue
        });
      }
      
      // Construir a expressão switch
      let result = `${type} ${varName} = switch (${switchVar}) {\n`;
      
      // Adicionar cada caso
      for (const switchCase of switchCases) {
        const labels = switchCase.labels.join(', ');
        const value = switchCase.value;
        
        result += `  case ${labels} -> ${value};\n`;
      }
      
      result += '};';
      
      return result;
    });
  }

  /**
   * Converte um switch com return para expressão switch
   * Melhorado para formatação consistente e agrupamento de casos
   * @param text Texto a ser convertido
   */
  private convertReturnSwitch(text: string): string {
    const pattern = this.getReturnSwitchPattern();
    pattern.lastIndex = 0;
    
    return text.replace(pattern, (match, switchVar, body) => {
      // Verificar se já começa com "return"
      const hasReturn = match.trim().startsWith('return');
      
      // Analisar casos
      const switchCases: Array<{ labels: string[], value: string }> = [];
      
      // Processar padrão caso a caso
      const lines = body.split('\n');
      let currentLabels: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Ignorar linhas vazias
        if (line === '') {
          continue;
        }
        
        // Captura de case
        const caseMatch = line.match(/case\s+([^:]+):/);
        if (caseMatch) {
          // Se já temos etiquetas, adicionar o caso atual se tiver valor
          if (currentLabels.length > 0 && currentLabels[0] !== 'default' && i + 1 < lines.length) {
            // Verificar se a próxima linha tem um return
            const nextLine = lines[i + 1].trim();
            const returnMatch = nextLine.match(/return\s+([^;]+);/);
            
            if (returnMatch) {
              switchCases.push({
                labels: [...currentLabels],
                value: returnMatch[1].trim()
              });
              i++; // Pular a linha de return
            }
            
            currentLabels = [];
          }
          
          // Guardar o label atual
          currentLabels.push(caseMatch[1].trim());
          continue;
        }
        
        // Captura de default
        const defaultMatch = line.match(/default:/);
        if (defaultMatch) {
          currentLabels = ['default'];
          
          // Se a próxima linha tem um return, adicionar como caso default
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            const returnMatch = nextLine.match(/return\s+([^;]+);/);
            
            if (returnMatch) {
              switchCases.push({
                labels: ['default'],
                value: returnMatch[1].trim()
              });
              i++; // Pular a linha de return
            }
          }
          
          continue;
        }
        
        // Captura de return em casos agrupados
        const returnMatch = line.match(/return\s+([^;]+);/);
        if (returnMatch && currentLabels.length > 0) {
          switchCases.push({
            labels: [...currentLabels],
            value: returnMatch[1].trim()
          });
          currentLabels = [];
        }
      }
      
      // Construir a expressão switch
      let result = hasReturn ? `return switch (${switchVar}) {\n` : `switch (${switchVar}) {\n`;
      
      // Adicionar cada caso
      for (const switchCase of switchCases) {
        const labels = switchCase.labels.join(', ');
        const value = switchCase.value;
        
        result += `  case ${labels} -> ${value};\n`;
      }
      
      result += '};';
      
      return result;
    });
  }
}