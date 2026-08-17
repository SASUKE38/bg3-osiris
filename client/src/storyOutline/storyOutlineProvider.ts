import {
	CancellationToken,
	commands,
	DataTransfer,
	DataTransferItem,
	Event,
	EventEmitter,
	ExtensionContext,
	TreeDataProvider,
	TreeDragAndDropController,
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
	requestDeleteStoryTreeNode,
	RequestDeleteStoryTreeNodeParams,
	requestGetStoryTreeNodeChildren,
	RequestGetStoryTreeNodeChildrenParams,
	RequestGetStoryTreeNodeChildrenResult,
	requestGetStoryTreeNodePath,
	RequestGetStoryTreeNodePathParams,
	RequestGetStoryTreeNodePathResult,
	requestMoveStoryTreeNode,
	RequestMoveStoryTreeNodeParams,
	requestOverrideStoryTreeNode,
	RequestOverrideStoryTreeNodeParams,
	RequestOverrideStoryTreeNodeResult,
	requestRenameStoryTreeNode,
	RequestRenameStoryTreeNodeParams,
	requestTestStoryTreeName,
	RequestTestStoryTreeNameParams,
	RequestTestStoryTreeNameResult
} from "bg3-osiris-shared";
import { ComponentBase } from "../componentBase";
import { Client, clients } from "../extension";
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

interface StoryItemDragAndDropTransferPayload {
	label: string;
	folder: string;
	isRoot: boolean;
	isOverriden: boolean;
}

export class StoryOutlineProvider
	extends ComponentBase
	implements TreeDataProvider<StoryItem>, TreeDragAndDropController<StoryItem>
{
	private static readonly dragAndDropMimeType = "application/vnd.code.tree.story-outline";
	dropMimeTypes: readonly string[] = [StoryOutlineProvider.dragAndDropMimeType];
	dragMimeTypes: readonly string[] = [StoryOutlineProvider.dragAndDropMimeType];
	private _onDidChangeTreeData: EventEmitter<StoryItem | undefined | null | void> = new EventEmitter<
		StoryItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: Event<StoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(context: ExtensionContext) {
		super(context);
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OpenGoal", this.handleOpenGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.AddGoal", this.handleAddGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OverrideGoal", this.handleOverrideGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.DeleteGoal", this.handleDeleteGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.RenameGoal", this.handleRenameGoal));
	}

	public async handleDrag(
		source: readonly StoryItem[],
		dataTransfer: DataTransfer,
		token: CancellationToken
	): Promise<void> {
		const dataTransferPayload: StoryItemDragAndDropTransferPayload[] = source.map((value) => {
			return {
				label: value.label,
				folder: value.folder,
				isRoot: value.isRoot,
				isOverriden: value.isOverriden
			};
		});
		dataTransfer.set(StoryOutlineProvider.dragAndDropMimeType, new DataTransferItem(dataTransferPayload));
	}

	public async handleDrop(
		target: StoryItem | undefined,
		dataTransfer: DataTransfer,
		token: CancellationToken
	): Promise<void> {
		if (!target) return;
		try {
			const items = dataTransfer.get(StoryOutlineProvider.dragAndDropMimeType)?.value as
				| StoryItemDragAndDropTransferPayload[]
				| undefined;
			if (!items) return;
			const folder = items[0].folder;

			if (!items.every((value) => value.folder === folder)) {
				window.showErrorMessage("A move operation cannot contain goals from multiple workspaces.");
				return;
			}

			let didWarning = false;
			const client = clients.get(folder);
			if (!client) return;

			// Parallelize this?
			for (const item of items) {
				if (item.isRoot || !item.isOverriden) {
					if (!didWarning) {
						window.showErrorMessage("Folders and inherited goals cannot be moved.");
						didWarning = true;
					}
					continue;
				}

				const params: RequestMoveStoryTreeNodeParams = {
					targetName: target.isRoot ? "" : target.label,
					sourceName: item.label
				};
				await client.connection.sendRequest(requestMoveStoryTreeNode, params);
			}
			this.refresh();
		} catch (e) {
			console.error(`An error occurred during the drop operation: ${e}`);
		}
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
			const labelA = a.label.toUpperCase();
			const labelB = b.label.toUpperCase();
			if (labelA < labelB) return -1;
			if (labelA === labelB) return 0;
			return 1;
		});
	}

	private refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	private async getGoalName(client: Client): Promise<string | undefined> {
		return await window.showInputBox({
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
		const name = await this.getGoalName(client);
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

	private readonly handleDeleteGoal = async (element?: StoryItem) => {
		if (!element || element.isRoot) return;
		const client = clients.get(element.folder);
		if (!client) return;
		const params: RequestDeleteStoryTreeNodeParams = { name: element.label };
		await client.connection.sendRequest(requestDeleteStoryTreeNode, params);
		this.refresh();
	};

	private readonly handleRenameGoal = async (element?: StoryItem) => {
		if (!element || element.isRoot) return;
		const client = clients.get(element.folder);
		if (!client) return;
		const name = await this.getGoalName(client);
		if (!name) return;

		const params: RequestRenameStoryTreeNodeParams = { targetName: name, oldName: element.label };
		await client.connection.sendRequest(requestRenameStoryTreeNode, params);
		this.refresh();
	};
}
