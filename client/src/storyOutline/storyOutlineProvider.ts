import {
	commands,
	Event,
	EventEmitter,
	ExtensionContext,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	window,
	workspace
} from "vscode";
import { InheritedGoalContentProvider } from "./inheritedGoalContentProvider";
import { notificationStoryTreeCreated, notificationStoryTreeCreatedParams, StoryTreeNode } from "bg3-osiris-shared";
import { ComponentBase } from "../componentBase";
import { LanguageClient } from "vscode-languageclient/node";

export class StoryItem extends TreeItem {
	constructor(
		public label: string,
		public folder: string,
		public readonly children: StoryItem[],
		public readonly collapsibleState: TreeItemCollapsibleState,
		public depth = 0
	) {
		super(label, collapsibleState);
		this.tooltip = this.label;
		this.folder = folder;
		this.depth = depth;
		this.command = {
			command: "bg3Osiris.OpenGoal",
			title: "Open",
			arguments: [this]
		};
		// this.iconPath = {
		// 	light: vscode.Uri.joinPath(extensionRoot, 'resources', 'light', 'dependency.svg'),
		// 	dark: vscode.Uri.joinPath(extensionRoot, 'resources', 'dark', 'dependency.svg')
		// };
	}
}

export class StoryOutlineProvider extends ComponentBase implements TreeDataProvider<StoryItem> {
	private _onDidChangeTreeData: EventEmitter<StoryItem | undefined | null | void> = new EventEmitter<
		StoryItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: Event<StoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private nodeMapping = new Map<string, Map<string, StoryTreeNode>>();

	constructor(context: ExtensionContext) {
		super(context);
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OpenGoal", this.handleOpenGoal));
	}

	initializeComponent(connection: LanguageClient): void {
		connection.onNotification(notificationStoryTreeCreated, this.handleStoryTreeCreated);
	}

	getTreeItem(element: StoryItem): TreeItem | Thenable<TreeItem> {
		return element;
	}

	async getChildren(element?: StoryItem | undefined): Promise<StoryItem[]> {
		const res: StoryItem[] = [];
		if (!element) {
			for (const folder of this.nodeMapping.keys()) {
				res.push(new StoryItem(folder, folder, [], TreeItemCollapsibleState.Expanded));
			}
		} else {
			const folder = element.folder;
			const map = this.nodeMapping.get(folder);
			if (map) {
				const children = map.get(element.label === element.folder ? "" : element.label)?.children;
				if (children) {
					for (const child of children) {
						res.push(
							new StoryItem(
								child.data ? child.data.name : "Goal",
								element.folder,
								[],
								TreeItemCollapsibleState.Collapsed
							)
						);
					}
				}
			}
		}
		return res.sort((a, b) => {
			if (a.label < b.label) return -1;
			if (a.label === b.label) return 0;
			return 1;
		});
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	private readonly handleStoryTreeCreated = (params: notificationStoryTreeCreatedParams) => {
		this.nodeMapping.set(params.folder, new Map(Object.entries(params.mapping)));
		this.refresh();
	};

	private readonly handleOpenGoal = async (element: StoryItem) => {
		const uri = Uri.parse(`${InheritedGoalContentProvider.scheme}:${element.label}.txt`);
		const doc = await workspace.openTextDocument(uri);
		await window.showTextDocument(doc, { preview: false });
	};
}
