import { ComponentBase } from "../componentBase";
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from "vscode";
import { clients } from "../extension";

interface StoryTreeNode {
	children: StoryTreeNode[];
	data?: StoryTreeData;
}

interface StoryTreeData {
	name: string;
	dependency?: string;
}

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
		// this.iconPath = {
		// 	light: vscode.Uri.joinPath(extensionRoot, 'resources', 'light', 'dependency.svg'),
		// 	dark: vscode.Uri.joinPath(extensionRoot, 'resources', 'dark', 'dependency.svg')
		// };
	}
}

export class StoryOutlineProvider extends ComponentBase implements TreeDataProvider<StoryItem> {
	private onDidChangeTreeDataEmitter: EventEmitter<StoryItem | undefined> = new EventEmitter<StoryItem | undefined>();
	readonly onDidChangeTreeDataEvent: Event<StoryItem | undefined> = this.onDidChangeTreeDataEmitter.event;

	getTreeItem(element: StoryItem): TreeItem | Thenable<TreeItem> {
		return element;
	}

	async getChildren(element?: StoryItem | undefined): Promise<StoryItem[]> {
		const res: StoryItem[] = [];
		if (!element) {
			for (const folder of clients.keys()) {
				const name = folder.split("/").pop();
				res.push(new StoryItem(name ?? "Mod", folder, [], TreeItemCollapsibleState.Expanded));
			}
		} else {
			const client = clients.get(element.folder);
			if (!client) return res;
			const requestName = element.label === element.folder.split("/").pop() ? "" : element.label;
			const children = (await client.connection.sendRequest("getStoryChildren", requestName)) as StoryTreeNode[];

			for (const child of children) {
				if (!child.data) continue;
				res.push(new StoryItem(child.data.name, element.folder, [], TreeItemCollapsibleState.Collapsed));
			}
		}
		return res.sort((a, b) => {
			if (a.label < b.label) return -1;
			if (a.label === b.label) return 0;
			return 1;
		});
	}
}
