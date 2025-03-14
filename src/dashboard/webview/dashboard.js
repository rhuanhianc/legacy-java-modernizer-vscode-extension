// Obtém o objeto vscode API
const vscode = acquireVsCodeApi();

// Envia mensagem de log para a extensão
function log(message) {
  vscode.postMessage({
    command: 'log',
    data: message
  });
}

// Armazenar estado
let state = {
    analysisData: analysisData || {
        matches: [],
        totalFiles: 0,
        analyzedFiles: 0,
        filesWithIssues: 0,
        totalPatterns: 0,
        statsByPatternType: {},
        statsByFile: {},
        impact: {
            readability: 0,
            performance: 0,
            maintenance: 0
        }
    },
    lastAnalysisDate: new Date().toISOString()
};

// Tentar armazenar estado inicial
try {
    vscode.setState(state);
    log("Estado inicial armazenado");
} catch (e) {
    log("Erro ao armazenar estado inicial: " + e.message);
}

// Inicializa os gráficos
let patternsChart = null;
let filesChart = null;

// Inicializa a página quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    log("Dashboard DOM loaded");
    
    // Atualizar a UI com os dados
    updateUI(state.analysisData);
    
    // Configurar listeners de eventos
    setupEventListeners();
    
    // Restaurar estado se disponível
    const savedState = vscode.getState();
    if (savedState) {
        log("Restaurando estado salvo");
        state = savedState;
        updateUI(state.analysisData);
    }
});

/**
 * Configurar listeners de eventos
 */
function setupEventListeners() {
    // Botão de aplicar todas as sugestões
    const applyAllBtn = document.getElementById('applyAllButton');
    if (applyAllBtn) {
        log("Found applyAllButton, setting up listener");
        applyAllBtn.addEventListener('click', () => {
            log("Apply all button clicked");
            vscode.postMessage({
                command: 'applyAllRefactorings'
            });
        });
    } else {
        log("Warning: applyAllButton not found in DOM");
    }
    
    // Botão de atualizar
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        log("Found refreshButton, setting up listener");
        refreshButton.addEventListener('click', () => {
            log("Refresh button clicked");
            vscode.postMessage({
                command: 'analyzeWorkspace'
            });
        });
    } else {
        log("Warning: refreshButton not found in DOM");
    }
    
    // Filtro de padrões
    const patternFilter = document.getElementById('patternFilter');
    if (patternFilter) {
        patternFilter.addEventListener('input', (e) => {
            const versionFilter = document.getElementById('versionFilter');
            filterPatterns(e.target.value, versionFilter ? versionFilter.value : 'all');
        });
    }
    
    // Filtro de versão
    const versionFilter = document.getElementById('versionFilter');
    if (versionFilter) {
        versionFilter.addEventListener('change', (e) => {
            const patternFilter = document.getElementById('patternFilter');
            filterPatterns(patternFilter ? patternFilter.value : '', e.target.value);
        });
    }
    
    // Filtro de arquivos
    const fileFilter = document.getElementById('fileFilter');
    if (fileFilter) {
        fileFilter.addEventListener('input', (e) => {
            filterFiles(e.target.value);
        });
    }
    
    // Configurar botões de arquivo dinâmicos
    setupFilesTableEventListeners();
    
    // Escutar mensagens do VSCode
    window.addEventListener('message', event => {
        const message = event.data;
        log("Received message: " + message.command);
        
        switch (message.command) {
            case 'updateData':
                log("Received updateData message");
                // Atualizar dados e UI
                state.analysisData = message.data;
                state.lastAnalysisDate = new Date().toISOString();
                try {
                    vscode.setState(state);
                    log("Estado atualizado após mensagem updateData");
                } catch (e) {
                    log("Erro ao atualizar estado: " + e.message);
                }
                updateUI(state.analysisData);
                break;
        }
    });
}

/**
 * Configurar listeners para botões na tabela de arquivos
 */
function setupFilesTableEventListeners() {
    log("Setting up files table event listeners");
    const filesTableBody = document.getElementById('filesTableBody');
    
    if (filesTableBody) {
        filesTableBody.addEventListener('click', (e) => {
            // Verificar se clicou em um botão
            if (e.target.classList.contains('file-action')) {
                const button = e.target;
                const fileUri = button.dataset.fileUri;
                
                if (!fileUri) {
                    log("Error: Button clicked but no fileUri found");
                    return;
                }
                
                log("File action clicked for: " + fileUri);
                
                if (button.textContent === 'Abrir') {
                    vscode.postMessage({
                        command: 'openFile',
                        fileUri: fileUri
                    });
                } else if (button.textContent === 'Modernizar') {
                    vscode.postMessage({
                        command: 'modernizeFile',
                        fileUri: fileUri
                    });
                }
            }
        });
    } else {
        log("Warning: filesTableBody not found in DOM");
    }
}

/**
 * Atualizar a UI com os dados de análise
 */
function updateUI(data) {
    log("Atualizando UI do dashboard");
    try {
        // Atualizar estatísticas gerais
        updateGeneralStats(data);
        
        // Atualizar medidores de impacto
        updateImpactMeters(data.impact);
        
        // Atualizar gráficos
        updateCharts(data);
        
        // Atualizar tabela de padrões
        updatePatternsTable(data);
        
        // Atualizar tabela de arquivos
        updateFilesTable(data);
        
        log("UI do dashboard atualizada com sucesso");
    } catch (e) {
        log("Erro ao atualizar UI: " + e.message + "\n" + e.stack);
    }
}

/**
 * Atualizar estatísticas gerais
 */
function updateGeneralStats(data) {
    try {
        log("Updating general stats");
        
        // Estatísticas de arquivos
        const totalFiles = document.getElementById('totalFiles');
        const filesWithPatterns = document.getElementById('filesWithPatterns');
        const filesModernized = document.getElementById('filesModernized');
        
        if (totalFiles) totalFiles.textContent = data.totalFiles || 0;
        if (filesWithPatterns) filesWithPatterns.textContent = data.filesWithIssues || 0;
        
        const modernizedCount = data.filesWithIssues - (Array.isArray(data.matches) ? data.matches.length : 0);
        if (filesModernized) filesModernized.textContent = Math.max(0, modernizedCount);
        
        // Estatísticas de padrões
        const totalPatterns = document.getElementById('totalPatterns');
        const suggestedPatterns = document.getElementById('suggestedPatterns');
        const appliedPatterns = document.getElementById('appliedPatterns');
        
        if (totalPatterns) totalPatterns.textContent = data.totalPatterns || 0;
        if (suggestedPatterns) suggestedPatterns.textContent = Array.isArray(data.matches) ? data.matches.length : 0;
        if (appliedPatterns) appliedPatterns.textContent = (data.totalPatterns || 0) - (Array.isArray(data.matches) ? data.matches.length : 0);
    } catch (e) {
        log("Erro ao atualizar estatísticas gerais: " + e.message);
    }
}

/**
 * Atualizar medidores de impacto
 */
function updateImpactMeters(impact) {
    if (!impact) {
        log("Dados de impacto não disponíveis");
        return;
    }
    
    try {
        log("Updating impact meters");
        
        const readabilityMeter = document.getElementById('readabilityMeter');
        const performanceMeter = document.getElementById('performanceMeter');
        const maintenanceMeter = document.getElementById('maintenanceMeter');
        
        const readabilityValue = document.getElementById('readabilityValue');
        const performanceValue = document.getElementById('performanceValue');
        const maintenanceValue = document.getElementById('maintenanceValue');
        
        // Definir valores
        if (readabilityMeter) readabilityMeter.style.width = `${(impact.readability || 0) * 10}%`;
        if (performanceMeter) performanceMeter.style.width = `${(impact.performance || 0) * 10}%`;
        if (maintenanceMeter) maintenanceMeter.style.width = `${(impact.maintenance || 0) * 10}%`;
        
        // Atualizar rótulos
        if (readabilityValue) readabilityValue.textContent = `${(impact.readability || 0).toFixed(1)}/10`;
        if (performanceValue) performanceValue.textContent = `${(impact.performance || 0).toFixed(1)}/10`;
        if (maintenanceValue) maintenanceValue.textContent = `${(impact.maintenance || 0).toFixed(1)}/10`;
    } catch (e) {
        log("Erro ao atualizar medidores de impacto: " + e.message);
    }
}

/**
 * Atualizar gráficos
 */
function updateCharts(data) {
    try {
        log("Updating charts");
        
        if (!data) {
            log("Dados não disponíveis para gráficos");
            return;
        }
        
        // Preparar dados para o gráfico de padrões
        const patternLabels = [];
        const patternData = [];
        const patternColors = [];
        
        // Verificar se statsByPatternType está disponível e processar
        let patternEntries = [];
        if (data.statsByPatternType) {
            if (data.statsByPatternType instanceof Map) {
                patternEntries = Array.from(data.statsByPatternType.entries());
            } else if (typeof data.statsByPatternType === 'object') {
                patternEntries = Object.entries(data.statsByPatternType);
            }
            
            // Ordenar por contagem (descendente)
            patternEntries.sort((a, b) => b[1] - a[1]);
            
            // Obter os 10 maiores
            const top10Patterns = patternEntries.slice(0, 10);
            
            // Preencher arrays para o gráfico
            for (const [patternId, count] of top10Patterns) {
                patternLabels.push(patternId);
                patternData.push(count);
                patternColors.push(getRandomColor());
            }
        } else {
            log("statsByPatternType não está disponível");
        }
        
        // Preparar dados para o gráfico de arquivos
        const fileLabels = [];
        const fileData = [];
        const fileColors = [];
        
        // Verificar se statsByFile está disponível e processar
        let fileEntries = [];
        if (data.statsByFile) {
            if (data.statsByFile instanceof Map) {
                fileEntries = Array.from(data.statsByFile.entries());
            } else if (typeof data.statsByFile === 'object') {
                fileEntries = Object.entries(data.statsByFile);
            }
            
            // Ordenar por contagem (descendente)
            fileEntries.sort((a, b) => b[1] - a[1]);
            
            // Obter os 10 maiores
            const top10Files = fileEntries.slice(0, 10);
            
            // Preencher arrays para o gráfico
            for (const [filePath, count] of top10Files) {
                // Extrair apenas o nome do arquivo do caminho
                const fileName = filePath.split('/').pop();
                fileLabels.push(fileName || filePath);
                fileData.push(count);
                fileColors.push(getRandomColor());
            }
        } else {
            log("statsByFile não está disponível");
        }
        
        // Obter contextos dos gráficos
        const patternsCtx = document.getElementById('patternsChart');
        const filesCtx = document.getElementById('filesChart');
        
        if (!patternsCtx || !filesCtx) {
            log("Canvas dos gráficos não encontrados");
            return;
        }
        
        // Criar ou atualizar o gráfico de padrões
        if (patternsChart) {
            patternsChart.data.labels = patternLabels;
            patternsChart.data.datasets[0].data = patternData;
            patternsChart.data.datasets[0].backgroundColor = patternColors;
            patternsChart.update();
        } else if (window.Chart && patternsCtx.getContext) {
            patternsChart = new Chart(patternsCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: patternLabels,
                    datasets: [{
                        label: 'Número de Ocorrências',
                        data: patternData,
                        backgroundColor: patternColors,
                        borderColor: patternColors.map(color => darkenColor(color, 20)),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    return tooltipItems[0].label;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            log("Chart.js não está disponível ou contexto do canvas inválido");
        }
        
        // Criar ou atualizar o gráfico de arquivos
        if (filesChart) {
            filesChart.data.labels = fileLabels;
            filesChart.data.datasets[0].data = fileData;
            filesChart.data.datasets[0].backgroundColor = fileColors;
            filesChart.update();
        } else if (window.Chart && filesCtx.getContext) {
            filesChart = new Chart(filesCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: fileLabels,
                    datasets: [{
                        label: 'Número de Padrões',
                        data: fileData,
                        backgroundColor: fileColors,
                        borderColor: fileColors.map(color => darkenColor(color, 20)),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    } catch (e) {
        log("Erro ao atualizar gráficos: " + e.message + "\n" + e.stack);
    }
}

/**
 * Atualizar tabela de padrões
 */
function updatePatternsTable(data) {
    try {
        log("Updating patterns table");
        
        const tableBody = document.getElementById('patternsTableBody');
        if (!tableBody) {
            log("Tabela de padrões não encontrada");
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!data.statsByPatternType) {
            log("Dados de padrões não disponíveis");
            return;
        }
        
        // Converter para array para fácil manipulação
        let patternEntries = [];
        if (data.statsByPatternType instanceof Map) {
            patternEntries = Array.from(data.statsByPatternType.entries());
        } else if (typeof data.statsByPatternType === 'object') {
            patternEntries = Object.entries(data.statsByPatternType);
        }
        
        // Ordenar por contagem (descendente)
        patternEntries.sort((a, b) => b[1] - a[1]);
        
        for (const [patternId, count] of patternEntries) {
            // Obter informações detalhadas do padrão
            const patternDetails = getPatternDetails(patternId);
            
            if (!patternDetails) {
                continue;
            }
            
            // Criar linha da tabela
            const row = document.createElement('tr');
            row.dataset.patternId = patternId;
            row.dataset.version = patternDetails.version.join(',');
            
            // Nome do padrão
            const nameCell = document.createElement('td');
            nameCell.textContent = patternDetails.name;
            row.appendChild(nameCell);
            
            // Descrição
            const descCell = document.createElement('td');
            descCell.textContent = patternDetails.description;
            row.appendChild(descCell);
            
            // Ocorrências
            const countCell = document.createElement('td');
            countCell.textContent = count;
            row.appendChild(countCell);
            
            // Versão Java
            const versionCell = document.createElement('td');
            versionCell.textContent = patternDetails.version.join(', ');
            row.appendChild(versionCell);
            
            // Complexidade
            const complexityCell = document.createElement('td');
            complexityCell.textContent = patternDetails.complexity;
            row.appendChild(complexityCell);
            
            tableBody.appendChild(row);
        }
    } catch (e) {
        log("Erro ao atualizar tabela de padrões: " + e.message);
    }
}

/**
 * Atualizar tabela de arquivos
 */
function updateFilesTable(data) {
    try {
        log("Updating files table");
        
        const tableBody = document.getElementById('filesTableBody');
        if (!tableBody) {
            log("Tabela de arquivos não encontrada");
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!data.statsByFile) {
            log("Dados de arquivos não disponíveis");
            return;
        }
        
        // Converter para array para fácil manipulação
        let fileEntries = [];
        if (data.statsByFile instanceof Map) {
            fileEntries = Array.from(data.statsByFile.entries());
        } else if (typeof data.statsByFile === 'object') {
            fileEntries = Object.entries(data.statsByFile);
        }
        
        // Ordenar por contagem (descendente)
        fileEntries.sort((a, b) => b[1] - a[1]);
        
        log(`Displaying ${fileEntries.length} files in the table`);
        
        for (const [filePath, count] of fileEntries) {
            // Criar linha da tabela
            const row = document.createElement('tr');
            row.dataset.filePath = filePath;
            
            // Nome do arquivo
            const nameCell = document.createElement('td');
            // Extrair apenas o nome do arquivo do caminho
            const fileName = filePath.split('/').pop();
            nameCell.textContent = fileName || filePath;
            nameCell.title = filePath;
            row.appendChild(nameCell);
            
            // Número de padrões
            const countCell = document.createElement('td');
            countCell.textContent = count;
            row.appendChild(countCell);
            
            // Ações
            const actionsCell = document.createElement('td');
            
            // Botão de modernizar
            const modernizeButton = document.createElement('button');
            modernizeButton.textContent = 'Modernizar';
            modernizeButton.className = 'file-action';
            modernizeButton.dataset.fileUri = filePath;
            
            // Botão de abrir
            const openButton = document.createElement('button');
            openButton.textContent = 'Abrir';
            openButton.className = 'file-action';
            openButton.style.marginLeft = '5px';
            openButton.dataset.fileUri = filePath;
            
            actionsCell.appendChild(modernizeButton);
            actionsCell.appendChild(openButton);
            row.appendChild(actionsCell);
            
            tableBody.appendChild(row);
        }
        
        // Configurar listeners para os botões
        setupFilesTableEventListeners();
    } catch (e) {
        log("Erro ao atualizar tabela de arquivos: " + e.message);
    }
}

/**
 * Filtrar padrões na tabela
 */
function filterPatterns(filterText, version) {
    try {
        const rows = document.querySelectorAll('#patternsTableBody tr');
        
        filterText = filterText.toLowerCase();
        
        rows.forEach(row => {
            const patternName = row.children[0].textContent.toLowerCase();
            const patternDescription = row.children[1].textContent.toLowerCase();
            const rowVersions = (row.dataset.version || '').split(',');
            
            // Verificar se o nome ou descrição contém o texto de filtro
            const textMatch = patternName.includes(filterText) || patternDescription.includes(filterText);
            
            // Verificar se a versão corresponde
            const versionMatch = version === 'all' || rowVersions.includes(version);
            
            // Mostrar ou ocultar a linha com base nos filtros
            row.style.display = textMatch && versionMatch ? '' : 'none';
        });
    } catch (e) {
        log("Erro ao filtrar padrões: " + e.message);
    }
}

/**
 * Filtrar arquivos na tabela
 */
function filterFiles(filterText) {
    try {
        const rows = document.querySelectorAll('#filesTableBody tr');
        
        filterText = filterText.toLowerCase();
        
        rows.forEach(row => {
            const fileName = row.children[0].textContent.toLowerCase();
            const filePath = (row.dataset.filePath || '').toLowerCase();
            
            // Verificar se o nome ou caminho contém o texto de filtro
            const match = fileName.includes(filterText) || filePath.includes(filterText);
            
            // Mostrar ou ocultar a linha
            row.style.display = match ? '' : 'none';
        });
    } catch (e) {
        log("Erro ao filtrar arquivos: " + e.message);
    }
}

/**
 * Obtém detalhes de um padrão pelo ID
 */
function getPatternDetails(patternId) {
    // Mapeamento de IDs para detalhes
    const patternDetailsMap = {
        'lambda-for-anonymous-class': {
            name: 'Lambdas para Classes Anônimas',
            description: 'Substituir implementações de interfaces funcionais com classes anônimas por expressões lambda',
            version: [8, 11, 17, 21],
            complexity: 'Média'
        },
        'for-each-to-stream': {
            name: 'For-each para Stream',
            description: 'Substituir loops for-each por operações de Stream quando apropriado',
            version: [8, 11, 17, 21],
            complexity: 'Média'
        },
        'optional-for-null-check': {
            name: 'Optional para Verificações de Nulo',
            description: 'Substituir verificações de nulo explícitas por Optional',
            version: [8, 11, 17, 21],
            complexity: 'Média'
        },
        'improved-try-with-resources': {
            name: 'Try-with-resources Aprimorado',
            description: 'Simplifica blocos try-with-resources usando variáveis finais ou efetivamente finais',
            version: [9, 11, 17, 21],
            complexity: 'Média'
        },
        'improved-diamond-operator': {
            name: 'Operador Diamante Aprimorado',
            description: 'Permite o uso do operador diamante com classes anônimas',
            version: [9, 11, 17, 21],
            complexity: 'Simples'
        },
        'var-for-local-variables': {
            name: 'Var para Variáveis Locais',
            description: 'Substituir declarações de tipo explícitas por var quando o tipo é inferível',
            version: [11, 17, 21],
            complexity: 'Simples'
        },
        'string-api-improvements': {
            name: 'Melhorias da API de String',
            description: 'Usar novos métodos da API de String como isBlank(), strip(), lines()',
            version: [11, 17, 21],
            complexity: 'Simples'
        },
        'text-blocks': {
            name: 'Blocos de Texto',
            description: 'Substituir strings multilinhas por blocos de texto para melhor legibilidade',
            version: [15, 17, 21],
            complexity: 'Simples'
        },
        'switch-expression': {
            name: 'Expressões Switch',
            description: 'Converter instruções switch tradicionais para expressões switch',
            version: [17, 21],
            complexity: 'Média'
        },
        'sealed-classes': {
            name: 'Classes Seladas',
            description: 'Converter hierarquias de classes fechadas para usar classes seladas',
            version: [17, 21],
            complexity: 'Complexa'
        },
        'pattern-matching-instanceof': {
            name: 'Pattern Matching para instanceof',
            description: 'Substituir verificações instanceof seguidas de cast por pattern matching',
            version: [17, 21],
            complexity: 'Média'
        },
        'record-for-dto': {
            name: 'Record para DTOs',
            description: 'Substituir classes simples de dados (DTOs) por Records',
            version: [17, 21],
            complexity: 'Complexa'
        }
    };
    
    return patternDetailsMap[patternId] || null;
}

/**
 * Gerar cor aleatória para gráficos
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Escurecer uma cor
 */
function darkenColor(color, amount) {
    let usePound = false;
    
    if (color[0] === '#') {
        color = color.slice(1);
        usePound = true;
    }
    
    const num = parseInt(color, 16);
    
    let r = (num >> 16) - amount;
    if (r < 0) r = 0;
    
    let g = ((num >> 8) & 0x00FF) - amount;
    if (g < 0) g = 0;
    
    let b = (num & 0x0000FF) - amount;
    if (b < 0) b = 0;
    
    return (usePound ? '#' : '') + (g | (r << 8) | (b << 16)).toString(16).padStart(6, '0');
}