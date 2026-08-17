/* eslint-disable @typescript-eslint/no-invalid-void-type */
import {
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
	requestRefreshStoryTree,
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

/**
 * Represents the data marshaled between a drag and a drop in the Story Tree.
 */
interface StoryItemDragAndDropTransferPayload {
	label: string;
	folder: string;
	isRoot: boolean;
	isOverriden: boolean;
}

/**
 * The provider for the Osiris Story Tree. This class handles all of the clients in the workspace.
 */
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
		context.subscriptions.push(commands.registerCommand("bg3Osiris.RefreshStoryTree", this.handleRefreshStoryTree));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OpenGoal", this.handleOpenGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.AddGoal", this.handleAddGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.OverrideGoal", this.handleOverrideGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.DeleteGoal", this.handleDeleteGoal));
		context.subscriptions.push(commands.registerCommand("bg3Osiris.RenameGoal", this.handleRenameGoal));
	}

	public async handleDrag(source: readonly StoryItem[], dataTransfer: DataTransfer): Promise<void> {
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

	public async handleDrop(target: StoryItem | undefined, dataTransfer: DataTransfer): Promise<void> {
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

			// TODO: Parallelize this?
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
				if (!child.node.data) continue;
				res.push(
					new StoryItem(
						child.node.data.name,
						element.folder,
						child.hasChildren ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
						child.isOverriden
					)
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

	/**
	 * Fires the onDidChangeTreeData event.
	 */
	private refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	/**
	 * Presents an input box to the user and requests the server to validate the input.
	 *
	 * @param client The client to request.
	 * @returns A string if the entered name is valid, undefined otherwise.
	 */
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

	/**
	 * The handler for the bg3Osiris.RefreshStoryTree command.
	 */
	private readonly handleRefreshStoryTree = async () => {
		for (const client of clients.values()) {
			await client.connection.sendRequest(requestRefreshStoryTree);
		}
		this.refresh();
	};

	/**
	 * The handler for the bg3Osiris.OpenGoal command.
	 * Opens the goal .txt file associated with the given {@link StoryItem}.
	 * Inherited goals are opened as virtual documents.
	 *
	 * @param element The {@link StoryItem} to open.
	 */
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

	/**
	 * The handler for the bg3Osiris.AddGoal command.
	 * Adds a new subgoal to the given {@link StoryItem}.
	 *
	 * @param element The {@link StoryItem} to add the subgoal to.
	 */
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

	/**
	 * The handler for the bg3Osiris.OverrideGoal command.
	 * Copies a goal to the mod if a {@link StoryItem} is provided.
	 *
	 * @param element The {@link StoryItem} to override.
	 */
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

	/**
	 * The handler for the bg3Osiris.DeleteGoal command.
	 * Deletes a goal from the mod if a {@link StoryItem} is provided.
	 *
	 * @param element The {@link StoryItem} to delete.
	 */
	private readonly handleDeleteGoal = async (element?: StoryItem) => {
		if (!element || element.isRoot) return;
		const client = clients.get(element.folder);
		if (!client) return;
		const params: RequestDeleteStoryTreeNodeParams = { name: element.label };
		await client.connection.sendRequest(requestDeleteStoryTreeNode, params);
		this.refresh();
	};

	/**
	 * The handler for the bg3Osiris.RenameGoal command.
	 * Renames a goal if a {@link StoryItem} is provided.
	 *
	 * @param element The {@link StoryItem} to rename.
	 */
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
