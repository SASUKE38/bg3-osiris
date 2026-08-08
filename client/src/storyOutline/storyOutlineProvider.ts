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
import {
	requestAddStoryTreeNode,
	RequestAddStoryTreeNodeParams,
	RequestAddStoryTreeNodeResult,
	requestGetStoryTreeNodeChildren,
	RequestGetStoryTreeNodeChildrenParams,
	RequestGetStoryTreeNodeChildrenResult,
	requestGetStoryTreeNodePath,
	RequestGetStoryTreeNodePathParams,
	RequestGetStoryTreeNodePathResult,
	requestOverrideStoryTreeNode,
	RequestOverrideStoryTreeNodeParams,
	RequestOverrideStoryTreeNodeResult,
	requestTestStoryTreeName,
	RequestTestStoryTreeNameParams,
	RequestTestStoryTreeNameResult
} from "bg3-osiris-shared";
import { ComponentBase } from "../componentBase";
import { clients } from "../extension";
import { InheritedGoalContentProvider } from "./inheritedGoalContentProvider";

export class StoryItem extends TreeItem {
	public contextValue: "overriden" | "inherited" | "root";

	constructor(
		public label: string,
		public folder: string,
		public collapsibleState: TreeItemCollapsibleState,
		public readonly isOverriden: boolean,
		public readonly isRoot = false
	) {
		super(label, collapsibleState);
		this.tooltip = this.label;
		this.folder = folder;
		this.contextValue = isRoot ? "root" : isOverriden ? "overriden" : "inherited";

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

	constructor(context: ExtensionContext) {
		super(context);
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OpenGoal", this.handleOpenGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.AddGoal", this.handleAddGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OverrideGoal", this.handleOverrideGoal));
	}

	getTreeItem(element: StoryItem): TreeItem | Thenable<TreeItem> {
		return element;
	}

	async getChildren(element?: StoryItem | undefined): Promise<StoryItem[]> {
		const res: StoryItem[] = [];

		if (!element) {
			for (const client of clients.values()) {
				const label = client.folder.uri.path.split("/").pop();
				if (!label) continue;
				res.push(
					new StoryItem(label, client.folder.uri.toString(), TreeItemCollapsibleState.Expanded, false, true)
				);
			}
		} else {
			const client = clients.get(element.folder);
			if (!client) return res;
			const params: RequestGetStoryTreeNodeChildrenParams = { name: element.isRoot ? "" : element.label };
			const children = (
				(await client.connection.sendRequest(
					requestGetStoryTreeNodeChildren,
					params
				)) as RequestGetStoryTreeNodeChildrenResult
			).children;
			for (const child of children) {
				if (!child[0].data) continue;
				res.push(
					new StoryItem(child[0].data.name, element.folder, TreeItemCollapsibleState.Collapsed, child[1])
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

	private readonly handleOpenGoal = async (element?: StoryItem) => {
		if (!element || element.isRoot) return;
		const client = clients.get(element.folder);
		if (!client) return;
		const params: RequestGetStoryTreeNodePathParams = { name: element.label };
		const path = (
			(await client.connection.sendRequest(
				requestGetStoryTreeNodePath,
				params
			)) as RequestGetStoryTreeNodePathResult
		).path;

		if (path === null) return;
		const uri = path
			? Uri.parse(path)
			: Uri.from({
					scheme: InheritedGoalContentProvider.scheme,
					path: `${element.label}.txt`,
					query: element.folder
				});
		const doc = await workspace.openTextDocument(uri);
		await window.showTextDocument(doc, { preview: false });
	};

	private readonly handleAddGoal = async (element?: StoryItem) => {
		if (!element) return;
		const client = clients.get(element.folder);
		if (!client) return;
		const name = await window.showInputBox({
			prompt: "Enter the goal's name.",
			validateInput: async (value) => {
				const validityParams: RequestTestStoryTreeNameParams = { name: value };
				return (
					(await client.connection.sendRequest(
						requestTestStoryTreeName,
						validityParams
					)) as RequestTestStoryTreeNameResult
				).reason;
			}
		});
		if (!name) return;

		const params: RequestAddStoryTreeNodeParams = { parent: element.isRoot ? "" : element.label, name };
		const uri = (
			(await client.connection.sendRequest(requestAddStoryTreeNode, params)) as RequestAddStoryTreeNodeResult
		).path;

		if (uri) {
			const doc = await workspace.openTextDocument(uri);
			await window.showTextDocument(doc, { preview: false });
		}
		this.refresh();
	};

	private readonly handleOverrideGoal = async (element?: StoryItem) => {
		if (!element || element.isRoot) return;
		const client = clients.get(element.folder);
		if (!client) return;
		const params: RequestOverrideStoryTreeNodeParams = { name: element.label };
		const success = (
			(await client.connection.sendRequest(
				requestOverrideStoryTreeNode,
				params
			)) as RequestOverrideStoryTreeNodeResult
		).success;
		if (success) {
			element.contextValue = "overriden";
			this.refresh();
		}
	};
}

/*

Architecture:
Data store in server
Possibly restrict commands based on if goal is overriden or not
Possibly optimize sending new tree to instead send only changes

Story Item contents:
label
tooltip
folder
collapsible state
isActive
uri

On request for deleting a goal:
	Find server to request based on folder field in tree item
	Send name to server
	In server:
	If goal is not an active goal, deny request
	Remove goal from node mapping and remove it from it's parent's list of children
	Remove the resource from the active goal array
	Delete the file
	In client:
	Refresh tree

On request for moving a goal:
	Find server to request based on folder field in tree item
	Send destination to server
	In server:
	If goal is not an active goal, deny request
	Remove goal from parent's list of children and add it to new parent's list of children
	Change the ParentTargetEdge of the goal in the file to the new parent
	Invalidate the resource or change the Parent node in the ast
	In client:
	Refresh tree

On request for renaming a goal:
	Find server to request based on folder field in tree item
	In server:
	Change all child files of the goal to have the correct parent name
	Change all child nodes of the goal to have the correct parent name
	Find resource in mod
	Change the name of the resource
	In client:
	Refresh tree

*/
