import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentDiagnosticReportKind,
	type DocumentDiagnosticReport,
	Connection,
	DidChangeConfigurationParams
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { DiagnosticProvider } from './diagnostics/diagnosticsProvider';
import { ComponentBase } from './ComponentBase';

interface ComponentContainer {
	new (server: Server): ComponentBase;
}

const components: Array<ComponentContainer> = [DiagnosticProvider];

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
	components: Array<ComponentBase>;
	hasConfigurationCapability = false;
	hasWorkspaceFolderCapability = false;
	hasDiagnosticRelatedInformationCapability = false;

	constructor(components: Array<ComponentContainer>) {
		const connection = createConnection(ProposedFeatures.all);
		const documents = new TextDocuments(TextDocument);
		connection.onInitialize(this.initializeHandler);
		connection.onInitialized(this.initializedHandler);
		connection.onDidChangeConfiguration(this.didchangeConfigurationHandler);
		documents.onDidClose(e => {
			documentSettings.delete(e.document.uri);
		});

		connection.onDidChangeWatchedFiles(_change => {
			// Monitored files have change in VSCode
			connection.console.log('We received a file change event');
		});

		connection.onCompletion(
			(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
				// The pass parameter contains the position of the text document in
				// which code complete got requested. For the example we ignore this
				// info and always provide the same completion items.
				return [
					{
						label: 'TypeScript',
						kind: CompletionItemKind.Text,
						data: 1
					},
					{
						label: 'JavaScript',
						kind: CompletionItemKind.Text,
						data: 2
					}
				];
			}
		);

		connection.onCompletionResolve(
			(item: CompletionItem): CompletionItem => {
				if (item.data === 1) {
					item.detail = 'TypeScript details';
					item.documentation = 'TypeScript documentation';
				} else if (item.data === 2) {
					item.detail = 'JavaScript details';
					item.documentation = 'JavaScript documentation';
				}
				return item;
			}
		);

		documents.listen(connection);
		connection.listen();

		this.connection = connection;
		this.documents = documents;
		this.components = components.map(component => new component(this));
		this.components.forEach(component => component.initialize(connection));
	}

	private initializeHandler = (params: InitializeParams): InitializeResult => {
		const capabilities = params.capabilities;

		this.hasConfigurationCapability = !!(
			capabilities.workspace && !!capabilities.workspace.configuration
		);
		this.hasWorkspaceFolderCapability = !!(
			capabilities.workspace && !!capabilities.workspace.workspaceFolders
		);
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
	}

	private initializedHandler = () => {
		if (this.hasConfigurationCapability) {
		this.connection.client.register(DidChangeConfigurationNotification.type, undefined);
		}
		if (this.hasWorkspaceFolderCapability) {
			this.connection.workspace.onDidChangeWorkspaceFolders(_event => {
				this.connection.console.log('Workspace folder change event received.');
			});
		}
	}

	private didchangeConfigurationHandler = (change: DidChangeConfigurationParams) => {
		if (this.hasConfigurationCapability) {
			// Reset all cached document settings
			documentSettings.clear();
		} else {
			globalSettings = (
				(change.settings.languageServerExample || defaultSettings)
			);
		}
		// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
		// We could optimize things here and re-fetch the setting first can compare it
		// to the existing setting, but this is out of scope for this example.
		this.connection.languages.diagnostics.refresh();
	}

	getDocumentSettings(resource: string): Thenable<ExampleSettings> {
		if (!this.hasConfigurationCapability) {
			return Promise.resolve(globalSettings);
		}
		let result = documentSettings.get(resource);
		if (!result) {
			result = this.connection.workspace.getConfiguration({
				scopeUri: resource,
				section: 'languageServerExample'
			});
			documentSettings.set(resource, result);
		}
		return result;
	}
}

new Server(components);