import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	Connection,
	ServerCapabilities
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticManager } from "./components/diagnostics/diagnosticsManager";
import { ComponentBase } from "./componentBase";
import { ModManager } from "./components/modManager";
import { DocumentationManager } from "./components/documentationManager";
import { SymbolManager } from "./components/symbolManager";
import { RenameProvider } from "./components/renameProvider";
import { ReferencesProvider } from "./components/referencesProvider";
import { HoverProvider } from "./components/hoverProvider";
import { DefinitionsProvider } from "./components/definitionsProvider";
import { SignatureHelpProvider } from "./components/signatureHelpProvider";
import { CallHierarchyProvider } from "./components/callHierarchyProvider";
import { CompletionProvider } from "./components/completionProvider";
import { notificationClientRunning, notificationServerRunning } from "bg3-osiris-shared";

type ComponentContainer = new (server: Server) => ComponentBase;

const components: ComponentContainer[] = [
	RenameProvider,
	ReferencesProvider,
	HoverProvider,
	DefinitionsProvider,
	SignatureHelpProvider,
	CallHierarchyProvider,
	CompletionProvider
];

export class Server {
	connection: Connection;
	documents: TextDocuments<TextDocument>;
	components: ComponentBase[];
	modManager: ModManager = new ModManager(this);
	symbolManager: SymbolManager = new SymbolManager(this);
	diagnosticManager: DiagnosticManager = new DiagnosticManager(this);
	documentationManager: DocumentationManager = new DocumentationManager(this);
	hasConfigurationCapability = false;

	constructor(components: ComponentContainer[]) {
		const connection = createConnection(ProposedFeatures.all);
		const documents = new TextDocuments(TextDocument);
		connection.onInitialize(this.initializeHandler);
		connection.onInitialized(this.initializedHandler);
		connection.onDidChangeConfiguration(this.didchangeConfigurationHandler);

		documents.listen(connection);
		connection.listen();

		this.connection = connection;
		this.documents = documents;
		this.components = components.map((component) => new component(this));
	}

	private initializeHandler = (params: InitializeParams): InitializeResult => {
		const capabilities = params.capabilities;

		this.hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);

		const result: InitializeResult = {
			capabilities: this.components.reduce(
				(capabilities, component) => ({
					...capabilities,
					...component.getCapabilities()
				}),
				{
					textDocumentSync: TextDocumentSyncKind.Incremental,
					...this.symbolManager.getCapabilities()
				} as ServerCapabilities
			)
		};
		return result;
	};

	private initializedHandler = () => {
		if (this.hasConfigurationCapability) {
			this.connection.client.register(DidChangeConfigurationNotification.type, undefined);
		}

		this.connection.onNotification(notificationClientRunning, () => {
			this.components.push(this.modManager);
			this.components.push(this.symbolManager);
			this.components.push(this.diagnosticManager);
			this.components.forEach((component) => component.initializeComponent?.(this.connection));
			this.connection.sendNotification(notificationServerRunning);
		});
	};

	private didchangeConfigurationHandler = () => {
		this.connection.languages.diagnostics.refresh();
	};
}

new Server(components);
