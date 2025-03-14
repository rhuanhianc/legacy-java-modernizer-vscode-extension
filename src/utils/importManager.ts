import * as vscode from 'vscode';

/**
 * Interface for an import to be added
 */
export interface JavaImport {
    packageName: string;
    className: string;
    isStatic?: boolean;
}

/**
 * Manager for imports in Java files
 */
export class ImportManager {
    /**
     * Adds an import to a Java document
     * @param document Java document
     * @param requiredImport Import to be added
     * @returns A WorkspaceEdit with the modification or undefined if the import already exists
     */
    public static async addImport(document: vscode.TextDocument, requiredImport: JavaImport): Promise<vscode.WorkspaceEdit | undefined> {
        // Check if import already exists
        if (this.importExists(document, requiredImport)) {
            return undefined;
        }

        // Find the position to add the import
        const position = this.findImportInsertPosition(document);
        if (!position) {
            return undefined;
        }

        // Build the import statement
        const importStatement = this.buildImportStatement(requiredImport);
        
        // Create the edit
        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, position, importStatement);
        
        return edit;
    }

    /**
     * Adds multiple imports to a Java document
     * @param document Java document
     * @param imports List of imports to be added
     * @returns A WorkspaceEdit with the modifications
     */
    public static async addImports(document: vscode.TextDocument, imports: JavaImport[]): Promise<vscode.WorkspaceEdit> {
        const edit = new vscode.WorkspaceEdit();
        
        // Filter imports that already exist
        const newImports = imports.filter(imp => !this.importExists(document, imp));
        
        if (newImports.length === 0) {
            return edit;
        }
        
        // Find the position to add the imports
        const position = this.findImportInsertPosition(document);
        if (!position) {
            return edit;
        }
        
        // Build the import statements
        const importStatements = newImports.map(imp => this.buildImportStatement(imp)).join('');
        
        // Add to the edit
        edit.insert(document.uri, position, importStatements);
        
        return edit;
    }

    /**
     * Checks if an import already exists in the document
     * @param document Java document
     * @param requiredImport Import to check
     */
    private static importExists(document: vscode.TextDocument, requiredImport: JavaImport): boolean {
        const importText = document.getText();
        
        // Create a regex pattern to find the import
        let pattern: RegExp;
        
        if (requiredImport.isStatic) {
            // Static import (ex: import static java.util.Arrays.asList;)
            pattern = new RegExp(`import\\s+static\\s+${requiredImport.packageName}\\.${requiredImport.className}\\s*;`, 'gm');
        } else {
            // Normal import (ex: import java.util.List;)
            // Check both specific import and wildcard import
            const specificPattern = new RegExp(`import\\s+${requiredImport.packageName}\\.${requiredImport.className}\\s*;`, 'gm');
            const wildcardPattern = new RegExp(`import\\s+${requiredImport.packageName}\\.\\*\\s*;`, 'gm');
            
            return specificPattern.test(importText) || wildcardPattern.test(importText);
        }
        
        return pattern.test(importText);
    }

    /**
     * Finds the position where the import should be inserted
     * @param document Java document
     */
    private static findImportInsertPosition(document: vscode.TextDocument): vscode.Position {
        const text = document.getText();
        
        // Try to find the last existing import
        const importRegex = /^import\s+(?:static\s+)?[\w.]+\s*;/gm;
        let lastImportMatch: RegExpExecArray | null = null;
        let match: RegExpExecArray | null;
        
        while ((match = importRegex.exec(text)) !== null) {
            lastImportMatch = match;
        }
        
        if (lastImportMatch) {
            // Position after the last import
            const offset = lastImportMatch.index + lastImportMatch[0].length;
            const pos = document.positionAt(offset);
            // Create a new position for the next line
            return new vscode.Position(pos.line + 1, 0);
        }
        
        // If no imports, look for the end of the package declaration
        const packageMatch = /^package\s+[\w.]+\s*;/m.exec(text);
        if (packageMatch) {
            const offset = packageMatch.index + packageMatch[0].length;
            const pos = document.positionAt(offset);
            // Create a new position for the next line
            return new vscode.Position(pos.line + 1, 0);
        }
        
        // If no package, insert at the beginning of the file
        return new vscode.Position(0, 0);
    }

    /**
     * Builds a complete import statement
     * @param javaImport Import to be built
     */
    private static buildImportStatement(javaImport: JavaImport): string {
        if (javaImport.isStatic) {
            return `import static ${javaImport.packageName}.${javaImport.className};\n`;
        } else {
            return `import ${javaImport.packageName}.${javaImport.className};\n`;
        }
    }
}