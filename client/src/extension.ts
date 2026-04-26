import { DocumentSemanticTokensProvider } from "./semantics/documentSemanticTokensProvider";
import { workspace, ExtensionContext, WorkspaceFolder, Uri, TextDocument } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, State, TransportKind } from "vscode-languageclient/node";
import { ComponentBase } from "./componentBase";
import { StoryOutlineProvider } from "./storyOutline/storyOutline";
import { join } from "path";

const clients = new Map<string, Client>();

type ComponentContainer = new (context: ExtensionContext) => ComponentBase;

const components: ComponentContainer[] = [StoryOutlineProvider, DocumentSemanticTokensProvider];

let _sortedWorkspaceFolders: string[] | undefined;
function sortedWorkspaceFolders(): string[] {
	if (_sortedWorkspaceFolders === void 0) {
		_sortedWorkspaceFolders = workspace.workspaceFolders ? workspace.workspaceFolders.map(folder => {
			let result = folder.uri.toString();
			if (result.charAt(result.length - 1) !== '/') {
				result = result + '/';
			}
			return result;
		}).sort(
			(a, b) => {
				return a.length - b.length;
			}
		) : [];
	}
	return _sortedWorkspaceFolders;
}
workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined);

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
	const sorted = sortedWorkspaceFolders();
	for (const element of sorted) {
		let uri = folder.uri.toString();
		if (uri.charAt(uri.length - 1) !== '/') {
			uri = uri + '/';
		}
		if (uri.startsWith(element)) {
			return workspace.getWorkspaceFolder(Uri.parse(element))!;
		}
	}
	return folder;
}

export class Client {
	readonly id: string = "bg3-osiris-language-client";
	readonly name: string = "BG3 Osiris";
	readonly serverPath: string = join("server", "out", "server.js");
	readonly folder: WorkspaceFolder;
	private intialized = false;
	context: ExtensionContext;
	components: ComponentBase[];
	connection: LanguageClient;

	constructor(context: ExtensionContext, components: ComponentContainer[], folder: WorkspaceFolder) {
		this.context = context;
		this.components = components.map((component) => new component(this.context));
		this.folder = folder;
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
			documentSelector: [{ scheme: "file", language: "osiris", pattern: `${this.folder.uri.fsPath}/**/*` }],
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
				this.connection.onRequest("getRoot", () => {
					return this.folder.uri.toString();
				})
				this.connection.onRequest("getWorkspace", (path: string) => {
					console.log("Incoming path: " + Uri.parse(path));
					console.log(workspace.getWorkspaceFolder(Uri.parse(path)));
				})
				this.components.forEach((component) => component.initializeComponent?.(this.connection));
			}
		});
		return client;
	}

	async stop() {
		this.connection.stop();
	}
}

export function activate(context: ExtensionContext) {

	function didOpenTextDocument(document: TextDocument) {
		if (document.languageId !== "osiris") {
			return;
		}

		const uri = document.uri;
		let folder = workspace.getWorkspaceFolder(uri);

		if (!folder) {
			return;
		}

		folder = getOuterMostWorkspaceFolder(folder);
		if (!clients.has(folder.uri.toString())) {
			const client = new Client(context, components, folder);
			clients.set(folder.uri.toString(), client);
			console.log(`Started BG3 Osiris server for ${folder.uri}`);
		}
	}

	workspace.onDidOpenTextDocument(didOpenTextDocument);
	workspace.textDocuments.forEach(didOpenTextDocument);
	workspace.onDidChangeWorkspaceFolders((event) => {
		for (const folder of event.removed) {
			const client = clients.get(folder.uri.toString());
			if (client) {
				clients.delete(folder.uri.toString());
				client.stop();
			}
		}
	});
}

export function deactivate(): Thenable<void> {
	const promises: Thenable<void>[] = [];
	for (const client of clients.values()) {
		promises.push(client.stop());
	}
	return Promise.all(promises).then(() => undefined);
}
