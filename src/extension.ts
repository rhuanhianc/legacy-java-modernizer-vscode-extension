import * as vscode from 'vscode';
import { Activator } from './activator';

/**
 * Armazenar a instância do ativador da extensão
 */
let activator: Activator | undefined;

/**
 * Ativação da extensão
 * @param context Contexto da extensão
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Ativando extensão "Legacy Java Modernizer"');
    
    // Criar e ativar a extensão
    activator = new Activator(context);
    activator.activate();
    
    console.log('Extensão "Legacy Java Modernizer" ativada com sucesso');
}

/**
 * Desativação da extensão
 */
export function deactivate() {
    console.log('Extensão "Legacy Java Modernizer" desativada');
}