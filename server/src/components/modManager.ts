import { Connection, CreateFilesParams, DeleteFilesParams, ServerCapabilities, TextEdit } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { Mod } from "../mods/mod";
import { join } from "path";
import {
	collectAttributes,
	findNodeChild,
	findRegion,
	findRegionChild,
	getNodeChildren,
	LSXMLParserFactory,
	ParseLSXML
} from "../utils/lsXML";
import {
	ModMetaModuleInfo,
	ModMetaModuleShortDesc,
	ModMetaPublishVersion,
	ModMetaScript,
	ModMetaScriptParameter
} from "../mods/modMeta";
import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { Resource, ResourceKind } from "../mods/resource/resource";
import { decodePath, encodePath, replaceFinalPathPart } from "../utils/pathUtils";
import { Signature } from "../mods/signature";
import { isArrayEqual } from "../utils/isArrayEqual";
import {
	requestAddStoryTreeNode,
	RequestAddStoryTreeNodeParams,
	RequestAddStoryTreeNodeResult,
	requestDeleteStoryTreeNode,
	RequestDeleteStoryTreeNodeParams,
	requestGetInheritedGoalContent,
	RequestGetInheritedGoalContentParams,
	RequestGetInheritedGoalContentResult,
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
import { extractFromPak } from "../utils/edge";
import { ASTNodeKind, GoalNode } from "../parser/ast/nodes";
import { GoalResource } from "../mods/resource/goalResource";

/**
 * Server component that manages mod loading and tracking.
 */
export class ModManager extends ComponentBase {
	mod?: Mod;

	calledSignatureToFileMap = new Map<string, Set<string>>();
	fileToCalledSignatureMap = new Map<string, Set<string>>();
	definedSignatureToFileMap = new Map<string, Set<string>>();
	fileToDefinedSignatureMap = new Map<string, Set<string>>();

	private readonly xmlParser = LSXMLParserFactory();

	async initializeComponent(connection: Connection): Promise<void> {
		const { rootFolder } = this.server;
		connection.workspace.onDidDeleteFiles(this.handleDeleteFiles);
		connection.workspace.onDidCreateFiles(this.handleCreateFiles);

		connection.onRequest(requestGetInheritedGoalContent, this.handleGetInheritedGoalContent);
		connection.onRequest(requestGetStoryTreeNodeChildren, this.handleGetStoryTreeNodeChildren);
		connection.onRequest(requestGetStoryTreeNodePath, this.handleGetStoryTreeNodePath);
		connection.onRequest(requestTestStoryTreeName, this.handleTestStoryTreeName);
		connection.onRequest(requestRefreshStoryTree, this.handleRefreshStoryTree);
		connection.onRequest(requestAddStoryTreeNode, this.handleAddStoryTreeNode);
		connection.onRequest(requestOverrideStoryTreeNode, this.handleOverrideStoryTreeNode);
		connection.onRequest(requestDeleteStoryTreeNode, this.handleDeleteStoryTreeNode);
		connection.onRequest(requestRenameStoryTreeNode, this.handleRenameStoryTreeNode);
		connection.onRequest(requestMoveStoryTreeNode, this.handleMoveStoryTreeNode);

		if (rootFolder) {
			this.mod = (await this.createModFromPath(decodePath(rootFolder.uri))) as Mod;

			if (this.mod) {
				for (const resource of this.mod.getAllGoals()) {
					await resource.load();
					this.server.diagnosticManager.handleDiagnostics(resource.getTextDocument());
				}
			}
		}
		this.server.diagnosticManager.installHandlers();
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {};
	}

	private handleDeleteFiles = (params: DeleteFilesParams) => {};

	private handleCreateFiles = (params: CreateFilesParams) => {};

	private readonly handleGetInheritedGoalContent = async (
		params: RequestGetInheritedGoalContentParams
	): Promise<RequestGetInheritedGoalContentResult> => {
		const owner = this.mod?.getInheritedGoalOwner(params.goalName);
		if (!owner) {
			return { content: undefined };
		}

		try {
			const extractedFile = (
				await extractFromPak(owner.path, `${owner.internalPath}/Story/RawFiles/Goals/${params.goalName}.txt`)
			).OutputPaths[0];
			if (!extractedFile) return { content: undefined };

			const content = readFileSync(extractedFile, { encoding: "utf-8" });
			rmSync(extractedFile);
			return { content };
		} catch (error) {
			this.server.connection.window.showErrorMessage(
				`An error occurred getting content for ${params.goalName}. Goal content cannot be shown.`
			);
			console.error(`An error occurred getting content for ${params.goalName}: ${error}`);
		}

		return { content: undefined };
	};

	//#region Story Tree

	/**
	 * The handler for the {@link requestGetStoryTreeNodeChildren} request.
	 * Fetches the children for a given story tree node.
	 *
	 * @param params The {@link RequestGetStoryTreeNodeChildrenParams} for the request.
	 * @returns A {@link RequestGetStoryTreeNodeChildrenResult} instance.
	 */
	private readonly handleGetStoryTreeNodeChildren = async (
		params: RequestGetStoryTreeNodeChildrenParams
	): Promise<RequestGetStoryTreeNodeChildrenResult> => {
		if (!this.mod) return { children: [] };
		return { children: await this.mod.storyTree.getStoryTreeNodeChildren(params.name) };
	};

	/**
	 * The handler for the {@link requestGetStoryTreeNodePath} request.
	 * Gets the path for a given story tree node.
	 *
	 * @param params The {@link RequestGetStoryTreeNodePathParams} for the request.
	 * @returns A {@link RequestGetStoryTreeNodePathResult} instance.
	 */
	private readonly handleGetStoryTreeNodePath = async (
		params: RequestGetStoryTreeNodePathParams
	): Promise<RequestGetStoryTreeNodePathResult> => {
		if (!this.mod) return { path: null };
		const path = this.mod.getResource(`${params.name}.txt`, "name")?.path;
		return { path: path ? encodePath(path) : path };
	};

	/**
	 * The handler for the {@link requestTestStoryTreeName} request.
	 * Determines if a given name is valid for a story tree node. That is,
	 * checks if the name is unique, contains only _, -, and alphanumeric characters,
	 * and is not empty.
	 *
	 * @param params The {@link RequestTestStoryTreeNameParams} for the request.
	 * @returns A {@link RequestTestStoryTreeNameResult} instance.
	 */
	private readonly handleTestStoryTreeName = (
		params: RequestTestStoryTreeNameParams
	): RequestTestStoryTreeNameResult => {
		if (!this.mod) return { reason: "No mod is loaded." };
		if (params.name.length === 0) return { reason: "The goal name cannot be empty." };
		if (!/^[A-Za-z0-9_-]+$/.test(params.name))
			return { reason: "The goal name can only contain _, -, and alphanumeric characters." };
		if (this.mod.getResource(`${params.name}.txt`, "name") || this.mod.getInheritedGoalOwner(params.name))
			return { reason: "The goal's name must be unique." };
		return { reason: "" };
	};

	/**
	 * The handler for the {@link requestRefreshStoryTree} request.
	 * Recreates the story tree for this mod.
	 */
	private readonly handleRefreshStoryTree = async () => {
		if (!this.mod) return;
		this.mod.storyTree.createTree(this.mod.getAllGoals(), this.mod.getAllDependencies());
	};

	/**
	 * The handler for the {@link requestAddStoryTreeNode} request.
	 * Adds a node to the story tree and writes a new file to the mod's
	 * goal path with initial Osiris.
	 *
	 * @param params The {@link RequestAddStoryTreeNodeParams} for the request.
	 * @returns A {@link RequestAddStoryTreeNodeResult} instance.
	 */
	private readonly handleAddStoryTreeNode = async (
		params: RequestAddStoryTreeNodeParams
	): Promise<RequestAddStoryTreeNodeResult> => {
		if (!this.mod) return {};
		await this.mod.storyTree.addStoryTreeNode(params.parent, params.name);
		const path = join(this.mod.path, this.mod.goalSubdirectory, `${params.name}.txt`);
		const content = `Version 1\r\nSubGoalCombiner SGC_AND\r\nINITSECTION\r\n\r\nKBSECTION\r\n\r\nEXITSECTION\r\n\r\nENDEXITSECTION\r\n${params.parent === "" ? "" : `ParentTargetEdge "${params.parent}"`}`;
		writeFileSync(path, content, { encoding: "utf-8" });
		this.createResource(`${params.name}.txt`, path);
		return { path };
	};

	/**
	 * The handler for the {@link requestOverrideStoryTreeNode} request.
	 * Overrides a given goal. Extracts the .txt file from the dependency pak
	 * and writes a copy to the goal's mod goal path.
	 *
	 * @param params The {@link RequestOverrideStoryTreeNodeParams} for the request.
	 * @returns A {@link RequestOverrideStoryTreeNodeResult} instance.
	 */
	private readonly handleOverrideStoryTreeNode = async (
		params: RequestOverrideStoryTreeNodeParams
	): Promise<RequestOverrideStoryTreeNodeResult> => {
		if (!this.mod) return { success: false };
		const dependency = this.mod.getInheritedGoalOwner(params.name);
		if (!dependency) return { success: false };
		const file = await extractFromPak(
			dependency.path,
			`${dependency.internalPath}/Story/RawFiles/Goals/${params.name}.txt`
		);
		if (file.OutputPaths[0]) {
			copyFileSync(file.OutputPaths[0], join(this.mod.path, this.mod.goalSubdirectory, `${params.name}.txt`));
			this.createResource(
				`${params.name}.txt`,
				join(this.mod.path, this.mod.goalSubdirectory, `${params.name}.txt`)
			);
			return { success: true };
		}
		return { success: false };
	};

	/**
	 * The handler for the {@link requestDeleteStoryTreeNode} request.
	 * Deletes a goal from the mod. Removes the node from the story tree and
	 * deletes the associated file from the mod.
	 *
	 * @param params The {@link RequestDeleteStoryTreeNodeParams} for the request.
	 */
	private readonly handleDeleteStoryTreeNode = async (params: RequestDeleteStoryTreeNodeParams) => {
		if (!this.mod) return;
		await this.mod.storyTree.deleteStoryTreeNode(params.name);
		rmSync(join(this.mod.path, this.mod.goalSubdirectory, `${params.name}.txt`));
		this.mod.removeResource(`${params.name}.txt`, "name");
	};

	/**
	 * The handler for the {@link requestRenameStoryTreeNode} request.
	 * Renames a goal in the mod. That is, renames the story tree node and file
	 * in the mod's goal path.
	 *
	 * @param params The {@link RequestRenameStoryTreeNodeParams} for the request.
	 */
	private readonly handleRenameStoryTreeNode = async (params: RequestRenameStoryTreeNodeParams) => {
		if (!this.mod) return;
		const resource = this.mod.getResource(`${params.oldName}.txt`, "name");
		if (!resource) return;

		const children = this.mod.storyTree.nodeMapping.get(params.oldName)?.children;
		if (children) {
			for (const child of children) {
				if (!child.data || !this.mod.getResource(`${child.data.name}.txt`, "name")) {
					this.server.connection.window.showErrorMessage("Goals with inherited children cannot be renamed.");
					return;
				}
			}
		}

		await this.mod.storyTree.renameStoryTreeNode(params.targetName, params.oldName);
		const newPath = replaceFinalPathPart(resource.path, params.targetName);
		renameSync(resource.path, newPath);
		resource.name = `${params.targetName}.txt`;
		resource.path = newPath;

		if (children) {
			const childResources = children.map((value) => {
				if (!value.data) return;
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const resource = this.mod!.getResource(`${value.data.name}.txt`, "name");
				return resource;
			});
			const edits: Record<string, TextEdit[]> = {};
			for (const resource of childResources) {
				if (
					!resource ||
					resource.kind !== ResourceKind.Goal ||
					(resource as GoalResource).parent !== params.oldName
				)
					continue;
				const footer = ((await resource.getRootNode()) as GoalNode).footer;
				if (!footer || footer.parentTargetEdge.kind != ASTNodeKind.STRING_NODE) continue;

				const edit = await this.getParentTargetEdgeEdit(resource as GoalResource, params.targetName);
				if (!edit) continue;
				Object.assign(edits, edit);
			}
			this.server.connection.workspace.applyEdit({ changes: edits });
		}
	};

	/**
	 * The handler for the {@link requestMoveStoryTreeNode} request.
	 * Changes a goal's parent. That is, the story tree node and associated
	 * file are changed to point to the new parent.
	 *
	 * @param params The {@link RequestMoveStoryTreeNodeParams} for the request.
	 */
	private readonly handleMoveStoryTreeNode = async (params: RequestMoveStoryTreeNodeParams) => {
		if (!this.mod) return;
		await this.mod.storyTree.moveStoryTreeNode(params.targetName, params.sourceName);
		const resource = this.mod.getResource(`${params.sourceName}.txt`, "name");
		if (!resource || resource.kind !== ResourceKind.Goal) return;
		const edit = await this.getParentTargetEdgeEdit(resource as GoalResource, params.targetName, true);
		if (!edit) return;
		this.server.connection.workspace.applyEdit({ changes: edit });
	};

	/**
	 * Modifies a resource so that its underlying file contains the syntactically correct ParentTargetEdge
	 * string for a given parent.
	 *
	 * @param resource The {@link GoalResource} to update.
	 * @param targetName The name of the new parent.
	 * @param insert Whether to insert the string "ParentTargetEdge" into the file if it is not present.
	 * @returns The edit with the modified parent. To be passed to workspace.applyEdit.
	 */
	private async getParentTargetEdgeEdit(
		resource: GoalResource,
		targetName: string,
		insert = false
	): Promise<Record<string, TextEdit[]> | undefined> {
		const edit: Record<string, TextEdit[]> = {};
		const root = (await resource.getRootNode()) as GoalNode;
		const encodedPath = encodePath(resource.path);
		if (!root.footer) {
			if (!insert || targetName === "") return;
			const position = root.exit.range.end;
			position.line += 1;
			position.character = 0;
			edit[encodedPath] = [TextEdit.insert(position, `ParentTargetEdge "${targetName}"`)];
		} else {
			if (root.footer.parentTargetEdge.kind !== ASTNodeKind.STRING_NODE) return;
			if (targetName === "") {
				const range = root.footer.range;
				edit[encodedPath] = [TextEdit.del(range)];
			} else {
				const range = root.footer.parentTargetEdge.range;
				range.start.character += 1;
				range.end.character -= 1;
				edit[encodedPath] = [TextEdit.replace(range, targetName)];
			}
		}
		resource.invalidate();
		return edit;
	}

	//#endregion

	//#region Resource Fetching

	/**
	 * Locates a {@link Resource} associated with a given path.
	 *
	 * @param path The path of the {@link Resource} to find. It is recommended to normalize the path first.
	 * @returns The {@link Resource} pointed to by the path, or `undefined` if it does not exist.
	 */
	findResource(path: string): Resource | undefined {
		if (this.mod) {
			const file = this.mod.getResource(path);
			if (file) return file;
		}
	}

	getAllResources(): Resource[] {
		if (this.mod) {
			return this.mod.getAllGoals();
		}
		return [];
	}

	createResource(name: string, path: string) {
		if (this.mod) {
			this.mod.createResource(name, path);
		}
	}

	//#endregion

	//#region Signature Processing

	async getAllDefinedSignatures(): Promise<Map<string, Signature>> {
		const res = new Map<string, Signature>();
		const activeFiles = this.mod?.getAllGoals();
		if (!activeFiles) return res;

		for (const resource of activeFiles) {
			for (const signature of (await resource.getData("signatures")).values()) {
				if (res.has(signature.name)) {
					const entrySignature = res.get(signature.name) as Signature;
					entrySignature.isDefined = entrySignature.isDefined || signature.isDefined;
					entrySignature.isCalled = entrySignature.isCalled || signature.isCalled;
					entrySignature.isRead = entrySignature.isRead || signature.isRead;
					entrySignature.isWritten = entrySignature.isWritten || signature.isWritten;
					for (const parameterCollection of signature.parameters) {
						if (!entrySignature.parameters.find((value) => isArrayEqual(value, parameterCollection))) {
							entrySignature.parameters.push(parameterCollection);
						}
					}
				} else {
					res.set(signature.name, signature.getCopy());
				}
			}
		}
		return res;
	}

	async updateSignatures(path: string, calledSignatures: Set<string>, definedSignatures: Set<string>) {
		function addEntries(signatureSet: Set<string>, map: Map<string, Set<string>>) {
			for (const entry of map) {
				entry[1].delete(path);
			}

			for (const signature of signatureSet) {
				if (!map.has(signature)) {
					map.set(signature, new Set<string>());
				}
				(map.get(signature) as Set<string>).add(path);
			}
		}

		this.fileToCalledSignatureMap.set(path, new Set<string>(calledSignatures));
		this.fileToDefinedSignatureMap.set(path, new Set<string>(definedSignatures));
		addEntries(calledSignatures, this.calledSignatureToFileMap);
		addEntries(definedSignatures, this.definedSignatureToFileMap);
	}

	//#endregion

	//#region Mod Creation

	/**
	 * Loads a mod from a given path.
	 *
	 * @param path The path of the mod to load. Should contain the mod's meta.lsx.
	 */
	async createModFromPath(path: string, isDependency?: boolean): Promise<Mod | undefined> {
		const meta = this.readModMeta(join(path, "meta.lsx"));
		return await this.createMod(path, meta, isDependency);
	}

	/**
	 * Loads a mod from a given path and {@link ModMetaModuleInfo}.
	 *
	 * @param meta The {@link ModMetaModuleInfo} of the mod to load.
	 * @param path The path to the mod directory to load. Should contain the mod's meta.lsx.
	 * @returns The loaded {@link Mod}.
	 */
	private async createMod(path: string, meta?: ModMetaModuleInfo, isDependency?: boolean): Promise<Mod> {
		const mod = isDependency ? new Mod(path, this, meta) : new Mod(path, this, meta);
		await mod.initialize();
		return Promise.resolve(mod);
	}

	/**
	 * Retrieves metadata associated with a given mod directory.
	 *
	 * @param path The path to the mod whose metadata should be loaded. Should contain the mod's meta.lsx.
	 * @returns The mod's metadata as a {@link ModMetaModuleInfo}.
	 */
	readModMeta(path: string): ModMetaModuleInfo | undefined {
		if (!existsSync(path)) return undefined;

		try {
			const meta: Partial<ModMetaModuleInfo> = {};
			meta.dependencies = [];
			meta.scripts = [];
			const rootNode = findRegionChild(findRegion(ParseLSXML(this.xmlParser, path), "Config"), "root");

			const moduleInfo = findNodeChild(rootNode, "ModuleInfo");
			if (!moduleInfo) return undefined;

			Object.assign(meta, collectAttributes<ModMetaModuleInfo>(moduleInfo));

			for (const dependency of getNodeChildren(findNodeChild(rootNode, "Dependencies"))) {
				meta.dependencies.push(collectAttributes<ModMetaModuleShortDesc>(dependency));
			}

			const publishVersion = findNodeChild(moduleInfo, "PublishVersion");
			if (publishVersion) {
				meta.publishVersion = collectAttributes<ModMetaPublishVersion>(publishVersion);
			}

			const scripts = findNodeChild(moduleInfo, "Scripts");
			if (scripts) {
				for (const script of getNodeChildren(scripts)) {
					const scriptObj = collectAttributes<ModMetaScript>(script);
					scriptObj.parameters = [];
					for (const parameters of getNodeChildren(script)) {
						for (const parameter of getNodeChildren(parameters)) {
							scriptObj.parameters.push(collectAttributes<ModMetaScriptParameter>(parameter));
						}
					}
					meta.scripts.push(scriptObj);
				}
			}
			return meta as ModMetaModuleInfo;
		} catch (e) {
			console.error(e);
		}
	}
}

//#endregion
