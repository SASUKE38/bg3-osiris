import { ExtensionContext } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

export class ComponentBase {
	context: ExtensionContext;
	constructor (context: ExtensionContext) {
		this.context = context;
	}

	initializeComponent(connection: LanguageClient) {}
}