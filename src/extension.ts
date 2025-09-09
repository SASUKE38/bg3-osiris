import * as vscode from 'vscode';
import { DocumentSemanticTokensProvider, legend } from './documentSemanticTokensProvider';

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'osiris' }, new DocumentSemanticTokensProvider(), legend));
	
    console.log('Activated BG3 Osiris extension');
}

export function deactivate() {}
