import * as vscode from 'vscode';
import { ComponentBase } from '../componentBase';
import { LanguageClient } from 'vscode-languageclient/node';

export class StoryItem extends vscode.TreeItem {
	constructor(
		public label: string,
		public readonly children: Array<StoryItem>,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		uri?: vscode.Uri,
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.label}`;

		// this.iconPath = {
		// 	light: vscode.Uri.joinPath(extensionRoot, 'resources', 'light', 'dependency.svg'),
		// 	dark: vscode.Uri.joinPath(extensionRoot, 'resources', 'dark', 'dependency.svg')
		// };
	}
}

export class StoryOutlineProvider extends ComponentBase implements vscode.TreeDataProvider<StoryItem> {
	private onDidChangeTreeDataEmitter: vscode.EventEmitter<StoryItem | undefined | void> = new vscode.EventEmitter<StoryItem | undefined | void>();
	readonly onDidChangeTreeDataEvent: vscode.Event<StoryItem | undefined | void> = this.onDidChangeTreeDataEmitter.event;

	constructor(context: vscode.ExtensionContext) {
		super(context);
		vscode.window.registerTreeDataProvider("story-outline-view", this);
	}

	initializeComponent(connection: LanguageClient) {
		
	}

	getTreeItem(element: StoryItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: StoryItem | undefined): vscode.ProviderResult<StoryItem[]> {
		return [new StoryItem("test", [], vscode.TreeItemCollapsibleState.Collapsed)];
	}
}
