import { DocumentSemanticTokensProvider } from "./semantics/documentSemanticTokensProvider";
import { workspace, ExtensionContext } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, State, TransportKind } from "vscode-languageclient/node";
import { ComponentBase } from "./componentBase";
import { StoryOutlineProvider } from "./storyOutline/storyOutline";
import { join } from "path";

let client: Client;

type ComponentContainer = new (context: ExtensionContext) => ComponentBase;

const components: ComponentContainer[] = [StoryOutlineProvider, DocumentSemanticTokensProvider];

export class Client {
	readonly id: string = "bg3-osiris-language-client";
	readonly name: string = "BG3 Osiris";
	readonly serverPath: string = join("server", "out", "server.js");
	private intialized = false;
	context: ExtensionContext;
	components: ComponentBase[];
	connection: LanguageClient;

	constructor(context: ExtensionContext, components: ComponentContainer[]) {
		this.context = context;
		this.components = components.map((component) => new component(this.context));
		this.connection = this.createConnection();
	}

	createConnection(): LanguageClient {
		const serverModule = this.context.asAbsolutePath(this.serverPath);
		const serverOptions: ServerOptions = {
			run: { module: serverModule, transport: TransportKind.ipc },
			debug: {
				module: serverModule,
				transport: TransportKind.ipc
			}
		};
		const clientOptions: LanguageClientOptions = {
			documentSelector: [{ scheme: "file", language: "osiris" }],
			synchronize: {
				fileEvents: workspace.createFileSystemWatcher("**/.clientrc")
			}
		};
		const client = new LanguageClient(this.id, this.name, serverOptions, clientOptions);

		client.start();
		client.onDidChangeState((event) => {
			if (!this.intialized && event.newState == State.Running) {
				this.intialized = true;
				this.connection.sendNotification("running");
				this.components.forEach((component) => component.initializeComponent?.(this.connection));
			}
		});
		return client;
	}

	stop() {
		this.connection.stop();
	}
}

export function activate(context: ExtensionContext) {
	client = new Client(context, components);

	console.log("Activated BG3 Osiris extension");
}

export function deactivate() {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
