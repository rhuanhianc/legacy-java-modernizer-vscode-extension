import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Interface para um item da árvore de pastas
 */
export interface FolderTreeItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  selected: boolean;
  children?: FolderTreeItem[];
  expanded?: boolean;
}

/**
 * Provedor da árvore de pastas para o explorador
 */
export class FolderTreeProvider {
  private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;
  
  private workspaceFolders: FolderTreeItem[] = [];
  private selectedPaths: Set<string> = new Set();
  
  constructor() {
    // Carregar seleções salvas
    console.log("Loading selected paths");
    this.loadSelectedPaths();
  }
  
  /**
   * Atualiza a árvore de pastas
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  
  /**
   * Carrega os workspaces e constrói a árvore
   */
  public async loadWorkspaceFolders(): Promise<FolderTreeItem[]> {
    console.log("Loading workspace folders");
    this.workspaceFolders = [];
    
    const wsFolders = vscode.workspace.workspaceFolders;
    if (!wsFolders) {
      console.log("No workspace folders found");
      return [];
    }
    
    for (const wsFolder of wsFolders) {
      try {
        const rootFolder: FolderTreeItem = {
          id: wsFolder.uri.toString(),
          name: wsFolder.name,
          path: wsFolder.uri.fsPath,
          type: 'folder',
          selected: this.selectedPaths.has(wsFolder.uri.fsPath),
          expanded: true,
          children: []
        };
        
        // Carregar subpastas e arquivos
        await this.loadChildren(rootFolder);
        
        this.workspaceFolders.push(rootFolder);
      } catch (error) {
        console.error(`Error loading workspace folder ${wsFolder.name}:`, error);
      }
    }
    
    console.log(`Loaded ${this.workspaceFolders.length} workspace folders`);
    return this.workspaceFolders;
  }
  
  /**
   * Carrega os filhos de uma pasta
   * @param parent Pasta pai
   */
  private async loadChildren(parent: FolderTreeItem): Promise<void> {
    try {
      // Ler o conteúdo da pasta
      const folderUri = vscode.Uri.file(parent.path);
      const entries = await vscode.workspace.fs.readDirectory(folderUri);
      
      // Filtrar para incluir apenas pastas e arquivos Java
      const filteredEntries = entries.filter(([name, type]) => {
        // Incluir pastas
        if (type === vscode.FileType.Directory) {
          // Ignorar pastas ocultas e node_modules
          return !name.startsWith('.') && name !== 'node_modules' && name !== 'target' && name !== 'build';
        }
        
        // Incluir apenas arquivos Java
        return type === vscode.FileType.File && name.endsWith('.java');
      });
      
      // Ordenar: primeiro pastas, depois arquivos (ambos em ordem alfabética)
      filteredEntries.sort((a, b) => {
        const [nameA, typeA] = a;
        const [nameB, typeB] = b;
        
        // Se um é pasta e o outro não, a pasta vem primeiro
        if (typeA === vscode.FileType.Directory && typeB !== vscode.FileType.Directory) {
          return -1;
        }
        if (typeA !== vscode.FileType.Directory && typeB === vscode.FileType.Directory) {
          return 1;
        }
        
        // Caso contrário, ordem alfabética
        return nameA.localeCompare(nameB);
      });
      
      // Criar itens para cada entrada
      for (const [name, type] of filteredEntries) {
        const childPath = path.join(parent.path, name);
        const isDirectory = type === vscode.FileType.Directory;
        
        const child: FolderTreeItem = {
          id: vscode.Uri.file(childPath).toString(),
          name,
          path: childPath,
          type: isDirectory ? 'folder' : 'file',
          selected: this.selectedPaths.has(childPath),
          expanded: false
        };
        
        if (isDirectory) {
          child.children = [];
          // Não carregamos os filhos agora, só quando o usuário expandir a pasta
        }
        
        parent.children?.push(child);
      }
    } catch (error) {
      console.error(`Error loading children for ${parent.path}:`, error);
    }
  }
  
  /**
   * Expande ou recolhe uma pasta
   * @param item Item a ser expandido/recolhido
   */
  public async toggleExpanded(item: FolderTreeItem): Promise<void> {
    if (item.type !== 'folder') return;
    
    item.expanded = !item.expanded;
    
    // Se estiver expandindo e não tiver carregado os filhos ainda
    if (item.expanded && item.children && item.children.length === 0) {
      await this.loadChildren(item);
    }
    
    this.refresh();
  }
  
  /**
   * Seleciona ou deseleciona um item
   * @param item Item a ser selecionado/deselecionado
   */
  public toggleSelected(item: FolderTreeItem): void {
    item.selected = !item.selected;
    
    // Atualizar a seleção nos filhos
    if (item.children) {
      this.updateChildrenSelection(item.children, item.selected);
    }
    
    // Atualizar a seleção nos pais
    this.updateParentSelection();
    
    // Atualizar o conjunto de caminhos selecionados
    this.updateSelectedPaths();
    
    // Salvar seleções
    this.saveSelectedPaths();
    
    this.refresh();
  }
  
  /**
   * Atualiza a seleção em todos os filhos
   * @param children Lista de filhos
   * @param selected Estado de seleção
   */
  private updateChildrenSelection(children: FolderTreeItem[], selected: boolean): void {
    for (const child of children) {
      child.selected = selected;
      
      if (child.children) {
        this.updateChildrenSelection(child.children, selected);
      }
    }
  }
  
  /**
   * Atualiza a seleção nos pais com base nos filhos
   */
  private updateParentSelection(): void {
    for (const folder of this.workspaceFolders) {
      this.updateFolderSelection(folder);
    }
  }
  
  /**
   * Atualiza a seleção de uma pasta com base em seus filhos
   * @param folder Pasta a ser atualizada
   * @returns True se todos os filhos estiverem selecionados
   */
  private updateFolderSelection(folder: FolderTreeItem): boolean {
    if (!folder.children || folder.children.length === 0) {
      return folder.selected;
    }
    
    let allSelected = true;
    let anySelected = false;
    
    for (const child of folder.children) {
      const childSelected = child.type === 'folder' 
        ? this.updateFolderSelection(child) 
        : child.selected;
      
      allSelected = allSelected && childSelected;
      anySelected = anySelected || childSelected;
    }
    
    // Se todos os filhos estiverem selecionados, o pai também está
    // Se alguns filhos estiverem selecionados, o pai está parcialmente selecionado
    folder.selected = allSelected;
    
    return allSelected;
  }
  
  /**
   * Atualiza o conjunto de caminhos selecionados
   */
  private updateSelectedPaths(): void {
    this.selectedPaths.clear();
    
    for (const folder of this.workspaceFolders) {
      this.collectSelectedPaths(folder);
    }
  }
  
  /**
   * Coleta os caminhos selecionados em uma pasta e seus filhos
   * @param item Item a ser verificado
   */
  private collectSelectedPaths(item: FolderTreeItem): void {
    if (item.selected) {
      this.selectedPaths.add(item.path);
    }
    
    if (item.children) {
      for (const child of item.children) {
        this.collectSelectedPaths(child);
      }
    }
  }
  
  /**
   * Obtém os caminhos selecionados
   */
  public getSelectedPaths(): string[] {
    return Array.from(this.selectedPaths);
  }
  
  /**
   * Salva os caminhos selecionados na configuração
   */
  private saveSelectedPaths(): void {
    // Usar configuração do VS Code para salvar
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    config.update('selectedPaths', Array.from(this.selectedPaths), vscode.ConfigurationTarget.Workspace);
  }
  
  /**
   * Carrega os caminhos selecionados da configuração
   */
  private loadSelectedPaths(): void {
    const config = vscode.workspace.getConfiguration('legacyJavaModernizer');
    const savedPaths = config.get<string[]>('selectedPaths', []);
    console.log(`Loaded ${savedPaths.length} selected paths`);
    this.selectedPaths = new Set(savedPaths);
  }
  
  /**
   * Serializa a árvore para enviar para o webview
   */
  public serializeTree(): any {
    return this.workspaceFolders;
  }
}