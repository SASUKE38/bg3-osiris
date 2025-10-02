import { DocumentSemanticTokensProvider } from './semantics/documentSemanticTokensProvider';
import { workspace, ExtensionContext } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { ComponentBase } from './componentBase';
import { StoryOutlineProvider } from './storyOutline/storyOutline';
import { join } from 'path';

let client: Client;

interface ComponentContainer {
	new (context: ExtensionContext): ComponentBase;
}

const components: Array<ComponentContainer> = [StoryOutlineProvider, DocumentSemanticTokensProvider];

export class Client {
	readonly id: string = 'bg3-osiris-language-client';
	readonly name: string = 'BG3 Osiris';
	readonly serverPath: string = join('server', 'out', 'server.js');
	context: ExtensionContext;
	components: Array<ComponentContainer>;
	connection: LanguageClient;

	constructor(context: ExtensionContext, components: Array<ComponentContainer>) {
		this.context = context;
		this.components = components;
		this.components.map(component => new component(this.context));

		this.connection = this.createConnection();
	}

	createConnection(): LanguageClient {
		const serverModule = this.context.asAbsolutePath(this.serverPath);
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
		const client = new LanguageClient(
			this.id,
			this.name,
			serverOptions,
			clientOptions
		);

		client.start();
		return client;
	}

	stop() {
		this.connection.stop();
	}
}

export function activate(context: ExtensionContext) {
	client = new Client(context, components);
    
    console.log('Activated BG3 Osiris extension');
}

export function deactivate() {
    if (!client) {
		return undefined;
	}
	return client.stop();
}
