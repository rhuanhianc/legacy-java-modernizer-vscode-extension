// Obter a API do VS Code
const vscode = acquireVsCodeApi();

// Armazenar estado
let state = {
    targetVersion: targetVersion || "11",
    analysisResults: null,
    recentFiles: []
};

// Elementos DOM
const analyzeBtn = document.getElementById('analyzeBtn');
const currentVersion = document.getElementById('currentVersion');
const changeVersionBtn = document.getElementById('changeVersionBtn');
const showDashboardBtn = document.getElementById('showDashboardBtn');
const applyAllBtn = document.getElementById('applyAllBtn');
const showMetricsBtn = document.getElementById('showMetricsBtn');
const analysisPlaceholder = document.getElementById('analysisPlaceholder');
const analysisResults = document.getElementById('analysisResults');
const recentFilesSection = document.getElementById('recentFilesSection');
const metricsSection = document.getElementById('metricsSection');

// Elementos de estatísticas
const analyzedFiles = document.getElementById('analyzedFiles');
const patternsFound = document.getElementById('patternsFound');
const filesWithPatterns = document.getElementById('filesWithPatterns');
const modernizationProgress = document.getElementById('modernizationProgress');
const modernizationProgressValue = document.getElementById('modernizationProgressValue');

// Elementos de métricas
const readabilityMeter = document.getElementById('readabilityMeter');
const performanceMeter = document.getElementById('performanceMeter');
const maintenanceMeter = document.getElementById('maintenanceMeter');
const readabilityValue = document.getElementById('readabilityValue');
const performanceValue = document.getElementById('performanceValue');
const maintenanceValue = document.getElementById('maintenanceValue');

// Inicializar a página
document.addEventListener('DOMContentLoaded', () => {
    // Definir versão atual
    initVersionDisplay();
    
    // Configurar listeners
    setupEventListeners();
    
    // Restaurar estado se disponível
    const savedState = vscode.getState();
    if (savedState) {
        state = savedState;
        updateUI();
    }
});

/**
 * Configurar listeners de eventos
 */
function setupEventListeners() {
    // Botão de análise
    analyzeBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'analyzeWorkspace'
        });
    });
    
    // Botão de mudança de versão
    changeVersionBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'changeTargetVersion'
        });
    });
    
    // Botão de dashboard
    showDashboardBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'showDashboard'
        });
    });
    
    // Botão de aplicar todas as sugestões
    applyAllBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'applyAllSuggestions'
        });
    });
    
    // Botão de métricas detalhadas
    showMetricsBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'showMetrics'
        });
    });
    
    // Escutar mensagens do VS Code
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateAnalysis':
                state.analysisResults = message.data;
                updateUI();
                break;
                
            case 'updateTargetVersion':
                state.targetVersion = message.version;
                updateVersionTag(state.targetVersion);
                updateVersionFeaturesList(state.targetVersion);
                vscode.setState(state);
                break;
        }
    });
}

/**
 * Atualizar a interface com base no estado atual
 */
function updateUI() {
    if (state.analysisResults) {
        // Mostrar resultados da análise
        analysisPlaceholder.style.display = 'none';
        analysisResults.style.display = 'block';
        
        // Atualizar estatísticas
        updateStats();
        
        // Atualizar arquivos recentes
        updateRecentFiles();
        
        // Atualizar métricas
        updateMetrics();
        
        // Salvar estado
        vscode.setState(state);
    } else {
        // Mostrar placeholder
        analysisPlaceholder.style.display = 'block';
        analysisResults.style.display = 'none';
        recentFilesSection.style.display = 'none';
        metricsSection.style.display = 'none';
    }
}

/**
 * Atualizar estatísticas
 */
function updateStats() {
    const results = state.analysisResults;
    
    analyzedFiles.textContent = results.analyzedFiles;
    patternsFound.textContent = results.totalPatterns;
    filesWithPatterns.textContent = results.filesWithIssues;
    
    // Calcular o progresso de modernização (padrões aplicados / total)
    const appliedPatterns = results.totalPatterns - (results.matches ? results.matches.length : 0);
    const progressPercentage = results.totalPatterns > 0 
        ? Math.round((appliedPatterns / results.totalPatterns) * 100) 
        : 0;
    
    modernizationProgress.style.width = `${progressPercentage}%`;
    modernizationProgressValue.textContent = `${progressPercentage}%`;
}

/**
 * Atualizar a lista de arquivos recentes
 */
function updateRecentFiles() {
    const results = state.analysisResults;
    
    // Verificar se temos arquivos com padrões
    if (results.filesWithIssues > 0) {
        recentFilesSection.style.display = 'block';
        const recentFilesList = document.getElementById('recentFilesList');
        recentFilesList.innerHTML = '';
        
        // Obter os 5 arquivos com mais padrões
        const fileEntries = [];
        
        // Verificar se statsByFile é um Map ou um objeto
        if (results.statsByFile instanceof Map) {
            fileEntries.push(...Array.from(results.statsByFile.entries()));
        } else if (typeof results.statsByFile === 'object') {
            fileEntries.push(...Object.entries(results.statsByFile));
        }
        
        // Ordenar por número de padrões (descendente)
        fileEntries.sort((a, b) => b[1] - a[1]);
        
        // Pegar os 5 primeiros
        const topFiles = fileEntries.slice(0, 5);
        
        for (const [filePath, patternCount] of topFiles) {
            // Construir o item de arquivo
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            // Extrair o nome e caminho do arquivo
            const pathParts = filePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const relativePath = pathParts.slice(Math.max(0, pathParts.length - 3, 0)).join('/');
            
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
            
            openBtn.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'openFile',
                    fileUri: filePath
                });
            });
            
            modernizeBtn.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'modernizeFile',
                    fileUri: filePath
                });
            });
            
            recentFilesList.appendChild(fileItem);
        }
    } else {
        recentFilesSection.style.display = 'none';
    }
}

/**
 * Atualizar métricas de impacto
 */
function updateMetrics() {
    const results = state.analysisResults;
    
    if (results.impact) {
        metricsSection.style.display = 'block';
        
        // Definir valores de métricas
        const readability = results.impact.readability;
        const performance = results.impact.performance;
        const maintenance = results.impact.maintenance;
        
        readabilityMeter.style.width = `${readability * 10}%`;
        performanceMeter.style.width = `${performance * 10}%`;
        maintenanceMeter.style.width = `${maintenance * 10}%`;
        
        readabilityValue.textContent = `${readability.toFixed(1)}/10`;
        performanceValue.textContent = `${performance.toFixed(1)}/10`;
        maintenanceValue.textContent = `${maintenance.toFixed(1)}/10`;
    } else {
        metricsSection.style.display = 'none';
    }
}

// Função para inicializar a exibição da versão
function initVersionDisplay() {
    // Atualizar a tag de versão
    updateVersionTag(state.targetVersion);
    
    // Preencher a lista de recursos disponíveis para a versão atual
    updateVersionFeaturesList(state.targetVersion);
    
    // Adicionar listener para o botão de mudança de versão
    document.getElementById('changeVersionBtn').addEventListener('click', () => {
        vscode.postMessage({
            command: 'changeTargetVersion'
        });
    });
}

// Função para atualizar a tag de versão
function updateVersionTag(version) {
    const currentVersion = document.getElementById('currentVersion');
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