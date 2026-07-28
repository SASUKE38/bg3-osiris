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
import { notificationStoryTreeCreated, notificationStoryTreeCreatedParams, requestGetGoalPath, RequestGetGoalPathParams, RequestGetGoalPathResult, StoryTreeNode } from "bg3-osiris-shared";
import { ComponentBase } from "../componentBase";
import { LanguageClient } from "vscode-languageclient/node";

export class StoryItem extends TreeItem {
	constructor(
		public label: string,
		public folder: string,
		public readonly children: StoryItem[],
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly isRoot = false,
		public uri?: Uri,
	) {
		super(label, collapsibleState);
		this.tooltip = this.label;
		this.folder = folder;
		this.uri = uri;

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
	private connection?: LanguageClient;

	constructor(context: ExtensionContext) {
		super(context);
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OpenGoal", this.handleOpenGoal));
	}

	initializeComponent(connection: LanguageClient): void {
		this.connection = connection;
		connection.onNotification(notificationStoryTreeCreated, this.handleStoryTreeCreated);
	}

	getTreeItem(element: StoryItem): TreeItem | Thenable<TreeItem> {
		return element;
	}

	async getChildren(element?: StoryItem | undefined): Promise<StoryItem[]> {
		const res: StoryItem[] = [];
		if (!element) {
			for (const folder of this.nodeMapping.keys()) {
				const label = folder.split("/").pop();
				res.push(new StoryItem(label ? label : folder, folder, [], TreeItemCollapsibleState.Expanded, true));
			}
		} else {
			const folder = element.folder;
			const map = this.nodeMapping.get(folder);
			const children = map?.get(element.isRoot ? "" : element.label)?.children;
			if (!children) return res;

			for (const child of children) {
				if (!child.data) continue;

				const params: RequestGetGoalPathParams = { name: child.data.name }
				const path = await this.connection?.sendRequest(requestGetGoalPath, params) as RequestGetGoalPathResult;

				const uri = path.path ? Uri.parse(path.path) : Uri.from({
					scheme: InheritedGoalContentProvider.scheme,
					path: `${child.data.name}.txt`,
					query: element.folder
				});

				res.push(
					new StoryItem(
						child.data.name,
						element.folder,
						[],
						TreeItemCollapsibleState.Collapsed,
						false,
						uri
					)
				);
			}
		}
		return res.sort((a, b) => {
			if (a.label < b.label) return -1;
			if (a.label === b.label) return 0;
			return 1;
		});
	}

	private refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	private readonly handleStoryTreeCreated = (params: notificationStoryTreeCreatedParams) => {
		this.nodeMapping.set(params.folder, new Map(Object.entries(params.mapping)));
		this.refresh();
	};

	private readonly handleOpenGoal = async (element: StoryItem) => {
		if (!element.uri) return;
		const doc = await workspace.openTextDocument(element.uri);
		await window.showTextDocument(doc, { preview: false });
	};
}
