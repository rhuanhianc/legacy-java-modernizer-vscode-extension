// Obter a API do VS Code
const vscode = acquireVsCodeApi();

// Armazenar estado
let state = {
    targetVersion: targetVersion || "11",
    analysisResults: null,
    recentFiles: [],
    lastAnalysisDate: null,
    folderStructure: []
};

// Elementos DOM
let analyzeBtn;
let currentVersion;
let versionStatus;
let changeVersionBtn;
let showDashboardBtn;
let applyAllBtn;
let showMetricsBtn;
let analysisPlaceholder;
let analysisResults;
let recentFilesSection;
let metricsSection;

// Elementos do explorador
let folderTree;
let refreshExplorerBtn;
let analyzeSelectedBtn;

// Elementos de estatísticas
let analyzedFiles;
let patternsFound;
let filesWithPatterns;
let modernizationProgress;
let modernizationProgressValue;

// Elementos de métricas
let readabilityMeter;
let performanceMeter;
let maintenanceMeter;
let readabilityValue;
let performanceValue;
let maintenanceValue;

// Inicializar a página
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing sidebar");
    
    // Inicializar elementos DOM
    initElements();
    
    // Definir versão atual
    initVersionDisplay();
    
    // Configurar listeners
    setupEventListeners();
    
    // Restaurar estado se disponível
    const savedState = vscode.getState();
    if (savedState) {
        console.log("Restoring saved state:", savedState);
        state = savedState;
        updateUI();
        
        // Atualizar a árvore de pastas se existir na estrutura salva
        if (state.folderStructure && state.folderStructure.length > 0) {
            updateFolderTree(state.folderStructure);
        }
    } else {
        console.log("No saved state found, using default state:", state);
        // Still save our initial state
        vscode.setState(state);
    }
    
    // Notify the extension that the webview is ready
    vscode.postMessage({
        command: 'webviewReady'
    });
});

/**
 * Inicializar referências a elementos DOM
 */
function initElements() {
    console.log("Initializing DOM elements");
    
    // Botões e elementos principais
    analyzeBtn = document.getElementById('analyzeBtn');
    currentVersion = document.getElementById('currentVersion');
    versionStatus = document.getElementById('versionStatus');
    changeVersionBtn = document.getElementById('changeVersionBtn');
    showDashboardBtn = document.getElementById('showDashboardBtn');
    applyAllBtn = document.getElementById('applyAllBtn');
    showMetricsBtn = document.getElementById('showMetricsBtn');
    analysisPlaceholder = document.getElementById('analysisPlaceholder');
    analysisResults = document.getElementById('analysisResults');
    recentFilesSection = document.getElementById('recentFilesSection');
    metricsSection = document.getElementById('metricsSection');
    
    // Elementos do explorador
    folderTree = document.getElementById('folderTree');
    refreshExplorerBtn = document.getElementById('refreshExplorerBtn');
    analyzeSelectedBtn = document.getElementById('analyzeSelectedBtn');
    
    // Elementos de estatísticas
    analyzedFiles = document.getElementById('analyzedFiles');
    patternsFound = document.getElementById('patternsFound');
    filesWithPatterns = document.getElementById('filesWithPatterns');
    modernizationProgress = document.getElementById('modernizationProgress');
    modernizationProgressValue = document.getElementById('modernizationProgressValue');
    
    // Elementos de métricas
    readabilityMeter = document.getElementById('readabilityMeter');
    performanceMeter = document.getElementById('performanceMeter');
    maintenanceMeter = document.getElementById('maintenanceMeter');
    readabilityValue = document.getElementById('readabilityValue');
    performanceValue = document.getElementById('performanceValue');
    maintenanceValue = document.getElementById('maintenanceValue');
    
    // Verificar se todos os elementos foram encontrados
    const missingElements = [];
    
    if (!analyzeBtn) missingElements.push('analyzeBtn');
    if (!currentVersion) missingElements.push('currentVersion');
    if (!versionStatus) missingElements.push('versionStatus');
    if (!changeVersionBtn) missingElements.push('changeVersionBtn');
    if (!showDashboardBtn) missingElements.push('showDashboardBtn');
    if (!applyAllBtn) missingElements.push('applyAllBtn');
    if (!showMetricsBtn) missingElements.push('showMetricsBtn');
    if (!analysisPlaceholder) missingElements.push('analysisPlaceholder');
    if (!analysisResults) missingElements.push('analysisResults');
    if (!recentFilesSection) missingElements.push('recentFilesSection');
    if (!metricsSection) missingElements.push('metricsSection');
    
    // Verificar elementos do explorador
    if (!folderTree) missingElements.push('folderTree');
    if (!refreshExplorerBtn) missingElements.push('refreshExplorerBtn');
    if (!analyzeSelectedBtn) missingElements.push('analyzeSelectedBtn');
    
    if (missingElements.length > 0) {
        console.error("Missing DOM elements:", missingElements.join(', '));
    } else {
        console.log("All DOM elements found successfully");
    }
}

/**
 * Configurar listeners de eventos
 */
function setupEventListeners() {
    console.log("Setting up event listeners");
    
    // Botão de análise
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            console.log("Analyze button clicked");
            vscode.postMessage({
                command: 'analyzeWorkspace'
            });
        });
    }
    
    // Botão de mudança de versão
    if (changeVersionBtn) {
        changeVersionBtn.addEventListener('click', () => {
            console.log("Change version button clicked");
            vscode.postMessage({
                command: 'changeTargetVersion'
            });
        });
    }
    
    // Botão de dashboard
    if (showDashboardBtn) {
        showDashboardBtn.addEventListener('click', () => {
            console.log("Show dashboard button clicked");
            vscode.postMessage({
                command: 'showDashboard'
            });
        });
    }
    
    // Botão de aplicar todas as sugestões
    if (applyAllBtn) {
        applyAllBtn.addEventListener('click', () => {
            console.log("Apply all button clicked");
            vscode.postMessage({
                command: 'applyAllSuggestions'
            });
        });
    }
    
    // Botão de métricas detalhadas
    if (showMetricsBtn) {
        showMetricsBtn.addEventListener('click', () => {
            console.log("Show metrics button clicked");
            vscode.postMessage({
                command: 'showMetrics'
            });
        });
    }
    
    // Botão de atualizar explorador
    if (refreshExplorerBtn) {
        refreshExplorerBtn.addEventListener('click', () => {
            console.log("Refresh explorer button clicked");
            vscode.postMessage({
                command: 'refreshExplorer'
            });
        });
    }
    
    // Botão de analisar selecionados
    if (analyzeSelectedBtn) {
        analyzeSelectedBtn.addEventListener('click', () => {
            console.log("Analyze selected button clicked");
            vscode.postMessage({
                command: 'analyzeSelected'
            });
        });
    }
    
    // Escutar mensagens do VS Code
    window.addEventListener('message', event => {
        const message = event.data;
        console.log("Received message from extension:", message.command);
        
        switch (message.command) {
            case 'updateAnalysis':
                console.log("Updating analysis data");
                state.analysisResults = message.data;
                state.lastAnalysisDate = new Date().toISOString();
                updateUI();
                vscode.setState(state);
                break;
                
            case 'updateTargetVersion':
                console.log("Updating target version to:", message.version);
                state.targetVersion = message.version;
                updateVersionTag(state.targetVersion);
                updateVersionFeaturesList(state.targetVersion);
                vscode.setState(state);
                break;
                
            case 'updateExplorer':
                console.log("Updating explorer structure");
                state.folderStructure = message.structure;
                updateFolderTree(message.structure);
                vscode.setState(state);
                break;
                
            case 'error':
                console.error("Error received from extension:", message.message);
                // Mostrar mensagem de erro se houver um elemento para isso
                break;
        }
    });
}

/**
 * Atualizar a interface com base no estado atual
 */
function updateUI() {
    console.log("Updating UI with current state");
    
    // Atualizar informações da versão
    updateVersionInfo();
    
    if (state.analysisResults) {
        console.log("Analysis results available, showing results");
        // Mostrar resultados da análise
        if (analysisPlaceholder) analysisPlaceholder.style.display = 'none';
        if (analysisResults) analysisResults.style.display = 'block';
        
        // Atualizar estatísticas
        updateStats();
        
        // Atualizar arquivos recentes
        updateRecentFiles();
        
        // Atualizar métricas
        updateMetrics();
    } else {
        console.log("No analysis results available, showing placeholder");
        // Mostrar placeholder
        if (analysisPlaceholder) analysisPlaceholder.style.display = 'block';
        if (analysisResults) analysisResults.style.display = 'none';
        if (recentFilesSection) recentFilesSection.style.display = 'none';
        if (metricsSection) metricsSection.style.display = 'none';
    }
}

/**
 * Atualizar informações da versão
 */
function updateVersionInfo() {
    console.log("Updating version info:", state.targetVersion);
    
    if (currentVersion) {
        updateVersionTag(state.targetVersion);
    }
    
    if (versionStatus) {
        versionStatus.textContent = "Ativo";
        versionStatus.style.color = "var(--success-color)";
    }
    
    updateVersionFeaturesList(state.targetVersion);
}

/**
 * Atualizar estatísticas
 */
function updateStats() {
    if (!state.analysisResults) {
        console.log("No analysis results available for stats update");
        return;
    }
    
    const results = state.analysisResults;
    console.log("Updating stats with results:", results);
    
    if (!analyzedFiles || !patternsFound || !filesWithPatterns) {
        console.error("Stats elements not found in DOM");
        return;
    }
    
    analyzedFiles.textContent = results.analyzedFiles || 0;
    patternsFound.textContent = results.totalPatterns || 0;
    filesWithPatterns.textContent = results.filesWithIssues || 0;
    
    // Calcular o progresso de modernização (padrões aplicados / total)
    const totalPatterns = results.totalPatterns || 0;
    const matchesCount = Array.isArray(results.matches) ? results.matches.length : 0;
    const appliedPatterns = totalPatterns - matchesCount;
    const progressPercentage = totalPatterns > 0 
        ? Math.round((appliedPatterns / totalPatterns) * 100) 
        : 0;
    
    console.log("Modernization progress:", progressPercentage, "% (", appliedPatterns, "/", totalPatterns, ")");
    
    if (modernizationProgress && modernizationProgressValue) {
        modernizationProgress.style.width = `${progressPercentage}%`;
        modernizationProgressValue.textContent = `${progressPercentage}%`;
    } else {
        console.error("Progress elements not found in DOM");
    }
}

/**
 * Atualizar a lista de arquivos recentes
 */
function updateRecentFiles() {
    if (!state.analysisResults) {
        console.log("No analysis results available for recent files update");
        if (recentFilesSection) recentFilesSection.style.display = 'none';
        return;
    }
    
    const results = state.analysisResults;
    
    // Verificar se temos arquivos com padrões
    if (results.filesWithIssues > 0 && results.statsByFile && recentFilesSection) {
        console.log("Updating recent files list");
        recentFilesSection.style.display = 'block';
        const recentFilesList = document.getElementById('recentFilesList');
        
        if (!recentFilesList) {
            console.error("Recent files list element not found in DOM");
            return;
        }
        
        recentFilesList.innerHTML = '';
        
        // Obter os 5 arquivos com mais padrões
        const fileEntries = [];
        
        // Se statsByFile for um Map, convertê-lo para array de pares
        if (results.statsByFile instanceof Map) {
            fileEntries.push(...Array.from(results.statsByFile.entries()));
        } else if (typeof results.statsByFile === 'object') {
            fileEntries.push(...Object.entries(results.statsByFile));
        }
        
        // Ordenar por número de padrões (descendente)
        fileEntries.sort((a, b) => b[1] - a[1]);
        
        // Pegar os 5 primeiros
        const topFiles = fileEntries.slice(0, 5);
        
        console.log("Top files with patterns:", topFiles);
        
        if (topFiles.length === 0) {
            const noFilesMessage = document.createElement('div');
            noFilesMessage.className = 'no-data-message';
            noFilesMessage.textContent = 'Nenhum arquivo com padrões encontrado.';
            recentFilesList.appendChild(noFilesMessage);
            return;
        }
        
        for (const [filePath, patternCount] of topFiles) {
            // Construir o item de arquivo
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            // Extrair o nome e caminho do arquivo
            const pathParts = filePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const relativePath = pathParts.slice(0, pathParts.length - 1).join('/');
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-name">${fileName}</div>
                    <div class="file-path">${relativePath}</div>
                    <div class="file-actions">
                        <button class="file-action-btn open-file-btn">Abrir</button>
                        <button class="file-action-btn modernize-file-btn">Modernizar</button>
                    </div>
                </div>
                <div class="file-patterns">${patternCount}</div>
            `;
            
            // Adicionar event listeners
            const openBtn = fileItem.querySelector('.open-file-btn');
            const modernizeBtn = fileItem.querySelector('.modernize-file-btn');
            
            if (openBtn) {
                openBtn.addEventListener('click', () => {
                    console.log("Open file button clicked for:", filePath);
                    vscode.postMessage({
                        command: 'openFile',
                        fileUri: filePath
                    });
                });
            }
            
            if (modernizeBtn) {
                modernizeBtn.addEventListener('click', () => {
                    console.log("Modernize file button clicked for:", filePath);
                    vscode.postMessage({
                        command: 'modernizeFile',
                        fileUri: filePath
                    });
                });
            }
            
            recentFilesList.appendChild(fileItem);
        }
    } else {
        console.log("No files with patterns found or not enough data");
        if (recentFilesSection) recentFilesSection.style.display = 'none';
    }
}

/**
 * Atualizar métricas de impacto
 */
function updateMetrics() {
    if (!state.analysisResults || !state.analysisResults.impact) {
        console.log("No impact data available for metrics update");
        if (metricsSection) metricsSection.style.display = 'none';
        return;
    }
    
    const results = state.analysisResults;
    
    if (results.impact && metricsSection) {
        console.log("Updating metrics with impact:", results.impact);
        metricsSection.style.display = 'block';
        
        // Definir valores de métricas
        const readability = results.impact.readability || 0;
        const performance = results.impact.performance || 0;
        const maintenance = results.impact.maintenance || 0;
        
        // Verify DOM elements exist before updating
        if (readabilityMeter && performanceMeter && maintenanceMeter &&
            readabilityValue && performanceValue && maintenanceValue) {
            
            readabilityMeter.style.width = `${readability * 10}%`;
            performanceMeter.style.width = `${performance * 10}%`;
            maintenanceMeter.style.width = `${maintenance * 10}%`;
            
            readabilityValue.textContent = `${readability.toFixed(1)}/10`;
            performanceValue.textContent = `${performance.toFixed(1)}/10`;
            maintenanceValue.textContent = `${maintenance.toFixed(1)}/10`;
        } else {
            console.error("One or more metric elements not found in DOM");
        }
    } else {
        console.log("No impact data available, hiding metrics section");
        if (metricsSection) metricsSection.style.display = 'none';
    }
}

/**
 * Atualizar a árvore de pastas
 */
function updateFolderTree(structure) {
    if (!folderTree) {
        console.error("Folder tree element not found in DOM");
        return;
    }
    
    console.log("Updating folder tree with structure:", structure);
    state.folderStructure = structure;
    
    // Limpar a árvore
    folderTree.innerHTML = '';
    
    if (!structure || structure.length === 0) {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'no-data-message';
        noDataMsg.textContent = 'Nenhuma pasta encontrada no workspace.';
        folderTree.appendChild(noDataMsg);
        return;
    }
    
    // Construir a árvore
    for (const item of structure) {
        const treeItem = createTreeItem(item);
        folderTree.appendChild(treeItem);
    }
}

/**
 * Cria um item da árvore
 */
function createTreeItem(item) {
    const treeItem = document.createElement('div');
    treeItem.className = 'tree-item';
    treeItem.dataset.id = item.id;
    treeItem.dataset.path = item.path;
    treeItem.dataset.type = item.type;
    
    const itemContent = document.createElement('div');
    itemContent.className = 'tree-item-content';
    
    // Ícone
    const icon = document.createElement('span');
    icon.className = 'tree-item-icon';
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tree-item-checkbox';
    checkbox.checked = item.selected;
    
    // Label
    const label = document.createElement('span');
    label.className = 'tree-item-label';
    label.textContent = item.name;
    
    // Adicionar elementos ao conteúdo
    itemContent.appendChild(icon);
    itemContent.appendChild(checkbox);
    itemContent.appendChild(label);
    
    // Adicionar o conteúdo ao item
    treeItem.appendChild(itemContent);
    
    // Se for uma pasta, adicionar classe e manipulador de eventos para expansão
    if (item.type === 'folder') {
        treeItem.classList.add(item.expanded ? 'folder-expanded' : 'folder-collapsed');
        
        // Container para filhos
        const children = document.createElement('div');
        children.className = 'tree-children';
        children.style.display = item.expanded ? 'block' : 'none';
        
        // Adicionar filhos se houver
        if (item.children && item.children.length > 0) {
            for (const child of item.children) {
                const childItem = createTreeItem(child);
                children.appendChild(childItem);
            }
        }
        
        // Adicionar filhos ao item
        treeItem.appendChild(children);
        
        // Manipulador para expansão
        itemContent.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                toggleFolder(item.id);
            }
        });
    }
    
    // Manipulador para seleção
    checkbox.addEventListener('change', () => {
        toggleSelection(item.id);
    });
    
    return treeItem;
}

/**
 * Expande ou recolhe uma pasta
 */
function toggleFolder(itemId) {
    console.log("Toggle folder:", itemId);
    vscode.postMessage({
        command: 'toggleFolder',
        itemId
    });
}

/**
 * Seleciona ou deseleciona um item
 */
function toggleSelection(itemId) {
    console.log("Toggle selection:", itemId);
    vscode.postMessage({
        command: 'toggleSelection',
        itemId
    });
}

// Função para inicializar a exibição da versão
function initVersionDisplay() {
    console.log("Initializing version display for:", state.targetVersion);
    
    // Atualizar a tag de versão
    updateVersionTag(state.targetVersion);
    
    // Preencher a lista de recursos disponíveis para a versão atual
    updateVersionFeaturesList(state.targetVersion);
}

// Função para atualizar a tag de versão
function updateVersionTag(version) {
    console.log("Updating version tag to:", version);
    
    if (!currentVersion) {
        console.error("Element 'currentVersion' not found in DOM");
        return;
    }
    
    currentVersion.textContent = `Java ${version}`;
    
    // Atualizar também a cor da tag com base na versão (LTS vs não-LTS)
    if (['8', '11', '17', '21'].includes(version)) {
        // Versões LTS em azul
        currentVersion.style.backgroundColor = 'var(--primary-color)';
    } else {
        // Versões não-LTS em roxo
        currentVersion.style.backgroundColor = 'var(--secondary-color)';
    }
}

// Função para atualizar a lista de recursos disponíveis para a versão atual
function updateVersionFeaturesList(version) {
    const versionFeaturesList = document.getElementById('versionFeaturesList');
    if (!versionFeaturesList) {
        console.error("Element 'versionFeaturesList' not found in DOM");
        return;
    }
    
    console.log("Updating version features list for Java", version);
    versionFeaturesList.innerHTML = '';
    
    // Recursos por versão
    const featuresByVersion = {
        '8': [
            { name: 'Lambdas', id: 'java8.lambda' },
            { name: 'Stream API', id: 'java8.streamAPI' },
            { name: 'Optional', id: 'java8.optional' }
        ],
        '9': [
            { name: 'Try-with-resources', id: 'java9.tryWithResources' },
            { name: 'Operador diamante', id: 'java9.diamondOperator' }
        ],
        '11': [
            { name: 'Inferência de tipo (var)', id: 'java11.var' },
            { name: 'Novos métodos de String', id: 'java11.stringMethods' }
        ],
        '15': [
            { name: 'Blocos de texto', id: 'java15.textBlocks' }
        ],
        '17': [
            { name: 'Expressões switch', id: 'java17.switchExpressions' },
            { name: 'Classes seladas', id: 'java17.sealedClasses' }
        ],
        '21': [
            { name: 'Pattern matching', id: 'java21.patternMatching' },
            { name: 'Records', id: 'java21.records' }
        ]
    };
    
    // Adicionar recursos disponíveis
    const availableVersions = Object.keys(featuresByVersion).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Mostrar recursos da versão atual e anteriores
    for (const ver of availableVersions) {
        if (parseInt(ver) <= parseInt(version)) {
            const features = featuresByVersion[ver];
            for (const feature of features) {
                const listItem = document.createElement('li');
                
                // Adicionar badge com a versão
                const badge = document.createElement('span');
                badge.className = 'version-feature-badge';
                badge.textContent = `Java ${ver}`;
                listItem.appendChild(badge);
                
                // Adicionar nome do recurso
                listItem.appendChild(document.createTextNode(feature.name));
                
                versionFeaturesList.appendChild(listItem);
            }
        }
    }
    
    // Se não houver recursos para exibir, mostrar uma mensagem
    if (versionFeaturesList.children.length === 0) {
        const listItem = document.createElement('li');
        listItem.textContent = 'Nenhum recurso disponível para esta versão.';
        versionFeaturesList.appendChild(listItem);
    }
}