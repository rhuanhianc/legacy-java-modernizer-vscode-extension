/**
 * Arquivo de setup global para os testes Jest
 */

import * as fs from 'fs';
import * as path from 'path';

// Configurar mock para configurações globais


// Configurar diretório temporário para testes
beforeAll(() => {
  const tempDir = path.join(__dirname, '../temp-test-files');
  jest.mock('vscode', () => require('./_mocks_/vscode'));
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
});

// Limpar diretório temporário após todos os testes
afterAll(() => {
  const tempDir = path.join(__dirname, '../temp-test-files');
  
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
});