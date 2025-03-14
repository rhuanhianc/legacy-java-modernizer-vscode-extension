import * as vscode from 'vscode';

/**
 * Interface para um import a ser adicionado
 */
export interface JavaImport {
    packageName: string;
    className: string;
    isStatic?: boolean;
}

/**
 * Gerenciador de imports para arquivos Java
 */
export class ImportManager {
    /**
     * Adiciona um import a um documento Java
     * @param document Documento Java
     * @param requiredImport Import a ser adicionado
     * @returns Um WorkspaceEdit com a modificação ou undefined se o import já existir
     */
    public static async addImport(document: vscode.TextDocument, requiredImport: JavaImport): Promise<vscode.WorkspaceEdit | undefined> {
        // Verificar se o import já existe
        if (this.importExists(document, requiredImport)) {
            return undefined;
        }

        // Encontrar o local para adicionar o import
        const position = this.findImportInsertPosition(document);
        if (!position) {
            return undefined;
        }

        // Construir a declaração de import
        const importStatement = this.buildImportStatement(requiredImport);
        
        // Criar a edição
        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, position, importStatement);
        
        return edit;
    }

    /**
     * Adiciona múltiplos imports a um documento Java
     * @param document Documento Java
     * @param imports Lista de imports a serem adicionados
     * @returns Um WorkspaceEdit com as modificações
     */
    public static async addImports(document: vscode.TextDocument, imports: JavaImport[]): Promise<vscode.WorkspaceEdit> {
        const edit = new vscode.WorkspaceEdit();
        
        // Filtrar imports que já existem
        const newImports = imports.filter(imp => !this.importExists(document, imp));
        
        if (newImports.length === 0) {
            return edit;
        }
        
        // Encontrar o local para adicionar os imports
        const position = this.findImportInsertPosition(document);
        if (!position) {
            return edit;
        }
        
        // Construir as declarações de import
        const importStatements = newImports.map(imp => this.buildImportStatement(imp)).join('');
        
        // Adicionar à edição
        edit.insert(document.uri, position, importStatements);
        
        return edit;
    }

    /**
     * Verifica se um import já existe no documento
     * @param document Documento Java
     * @param requiredImport Import a verificar
     */
    private static importExists(document: vscode.TextDocument, requiredImport: JavaImport): boolean {
        const importText = document.getText();
        
        // Criar um padrão regex para encontrar o import
        let pattern: RegExp;
        
        if (requiredImport.isStatic) {
            // Import estático (ex: import static java.util.Arrays.asList;)
            pattern = new RegExp(`import\\s+static\\s+${requiredImport.packageName}\\.${requiredImport.className}\\s*;`, 'gm');
        } else {
            // Import normal (ex: import java.util.List;)
            // Verificar tanto o import específico quanto o import com wildcard
            const specificPattern = new RegExp(`import\\s+${requiredImport.packageName}\\.${requiredImport.className}\\s*;`, 'gm');
            const wildcardPattern = new RegExp(`import\\s+${requiredImport.packageName}\\.\\*\\s*;`, 'gm');
            
            return specificPattern.test(importText) || wildcardPattern.test(importText);
        }
        
        return pattern.test(importText);
    }

    /**
     * Encontra a posição onde o import deve ser inserido
     * @param document Documento Java
     */
    private static findImportInsertPosition(document: vscode.TextDocument): vscode.Position | undefined {
        const text = document.getText();
        
        // Tentar encontrar o último import existente
        const importRegex = /^import\s+(?:static\s+)?[\w.]+\s*;/gm;
        let lastImportMatch: RegExpExecArray | null = null;
        let match: RegExpExecArray | null;
        
        while ((match = importRegex.exec(text)) !== null) {
            lastImportMatch = match;
        }
        
        if (lastImportMatch) {
            // Posicionar após o último import
            const offset = lastImportMatch.index + lastImportMatch[0].length;
            return document.positionAt(offset).with({ character: 0 }).translate(1, 0);
        }
        
        // Se não houver imports, procurar pelo fim da declaração do pacote
        const packageMatch = /^package\s+[\w.]+\s*;/m.exec(text);
        if (packageMatch) {
            const offset = packageMatch.index + packageMatch[0].length;
            return document.positionAt(offset).with({ character: 0 }).translate(1, 0);
        }
        
        // Se não houver pacote, inserir no início do arquivo
        return new vscode.Position(0, 0);
    }

    /**
     * Constrói uma declaração de import completa
     * @param javaImport Import a ser construído
     */
    private static buildImportStatement(javaImport: JavaImport): string {
        if (javaImport.isStatic) {
            return `import static ${javaImport.packageName}.${javaImport.className};\n`;
        } else {
            return `import ${javaImport.packageName}.${javaImport.className};\n`;
        }
    }
}