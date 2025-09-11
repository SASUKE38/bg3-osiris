import * as vscode from 'vscode';
import { DocumentSemanticTokensProvider, legend } from './semantics/documentSemanticTokensProvider';
import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { ComponentBase } from './componentBase';
import { StoryOutlineProvider } from './storyOutline/storyOutline';

let client: LanguageClient;

interface ComponentContainer {
	new (context: ExtensionContext): ComponentBase;
}

const components: Array<ComponentContainer> = [StoryOutlineProvider, DocumentSemanticTokensProvider];

export function activate(context: vscode.ExtensionContext) {

	components.map(component => new component(context));

	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'osiris' }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};
	client = new LanguageClient(
		'bg3-osiris-language-client',
		'BG3 Osiris',
		serverOptions,
		clientOptions
	);

	client.start();
    
    console.log('Activated BG3 Osiris extension');
}

export function deactivate() {
    if (!client) {
		return undefined;
	}
	return client.stop();
}
