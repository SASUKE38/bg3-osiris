import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	Connection,
	DidChangeConfigurationParams
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticProvider } from "./diagnostics/diagnosticsProvider";
import { ComponentBase } from "./componentBase";
import { ModManager } from "./mods/modManager";

type ComponentContainer = new (server: Server) => ComponentBase;

const components: ComponentContainer[] = [DiagnosticProvider, ModManager];

const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings = new Map<string, Thenable<ExampleSettings>>();

interface ExampleSettings {
	maxNumberOfProblems: number;
}

export class Server {
	connection: Connection;
	documents: TextDocuments<TextDocument>;
	components: ComponentBase[];
	hasConfigurationCapability = false;
	hasWorkspaceFolderCapability = false;
	hasDiagnosticRelatedInformationCapability = false;

	constructor(components: ComponentContainer[]) {
		const connection = createConnection(ProposedFeatures.all);
		const documents = new TextDocuments(TextDocument);
		connection.onInitialize(this.initializeHandler);
		connection.onInitialized(this.initializedHandler);
		connection.onDidChangeConfiguration(this.didchangeConfigurationHandler);
		documents.onDidClose((e) => {
			documentSettings.delete(e.document.uri);
		});

		documents.listen(connection);
		connection.listen();

		this.connection = connection;
		this.documents = documents;
		this.components = components.map((component) => new component(this));
	}

	private initializeHandler = (params: InitializeParams): InitializeResult => {
		const capabilities = params.capabilities;

		this.hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
		this.hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
		this.hasDiagnosticRelatedInformationCapability = !!(
			capabilities.textDocument &&
			capabilities.textDocument.publishDiagnostics &&
			capabilities.textDocument.publishDiagnostics.relatedInformation
		);

		const result: InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				completionProvider: {
					resolveProvider: true
				},
				diagnosticProvider: {
					interFileDependencies: false,
					workspaceDiagnostics: false
				}
			}
		};
		if (this.hasWorkspaceFolderCapability) {
			result.capabilities.workspace = {
				workspaceFolders: {
					supported: true
				}
			};
		}
		return result;
	};

	private initializedHandler = () => {
		if (this.hasConfigurationCapability) {
			this.connection.client.register(DidChangeConfigurationNotification.type, undefined);
		}
		if (this.hasWorkspaceFolderCapability) {
			this.connection.workspace.onDidChangeWorkspaceFolders((_event) => {
				this.connection.console.log("Workspace folder change event received.");
				console.log(_event);
			});
		}

		this.connection.onNotification("running", () => {
			this.components.forEach((component) => component.initializeComponent?.(this.connection));
		});
	};

	private didchangeConfigurationHandler = (change: DidChangeConfigurationParams) => {
		if (this.hasConfigurationCapability) {
			// Reset all cached document settings
			documentSettings.clear();
		} else {
			globalSettings = change.settings.languageServerExample || defaultSettings;
		}
		// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
		// We could optimize things here and re-fetch the setting first can compare it
		// to the existing setting, but this is out of scope for this example.
		this.connection.languages.diagnostics.refresh();
	};

	getDocumentSettings(resource: string): Thenable<ExampleSettings> {
		if (!this.hasConfigurationCapability) {
			return Promise.resolve(globalSettings);
		}
		let result = documentSettings.get(resource);
		if (!result) {
			result = this.connection.workspace.getConfiguration({
				scopeUri: resource,
				section: "languageServerExample"
			});
			documentSettings.set(resource, result);
		}
		return result;
	}
}

new Server(components);
