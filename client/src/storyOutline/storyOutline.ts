import * as vscode from 'vscode';
import { ComponentBase } from '../componentBase';

export class StoryItem extends vscode.TreeItem {
	constructor(
		public label: string,
		public readonly children: StoryItem[],
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
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
	private onDidChangeTreeDataEmitter: vscode.EventEmitter<StoryItem | undefined> = new vscode.EventEmitter<StoryItem | undefined>();
	readonly onDidChangeTreeDataEvent: vscode.Event<StoryItem | undefined> = this.onDidChangeTreeDataEmitter.event;

	constructor(context: vscode.ExtensionContext) {
		super(context);
		vscode.window.registerTreeDataProvider("story-outline-view", this);
	}

	getTreeItem(element: StoryItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: StoryItem | undefined): vscode.ProviderResult<StoryItem[]> {
		let label = "test";
		if (element) {
			label = element.label;
		}
		return [new StoryItem(label, [], vscode.TreeItemCollapsibleState.Collapsed)];
	}
}
