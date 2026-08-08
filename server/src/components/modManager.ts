import { Connection, CreateFilesParams, DeleteFilesParams, ServerCapabilities } from "vscode-languageserver";
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
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { Resource } from "../mods/resource/resource";
import { decodePath, encodePath } from "../utils/pathUtils";
import { Signature } from "../mods/signature";
import { isArrayEqual } from "../utils/isArrayEqual";
import {
	requestAddStoryTreeNode,
	RequestAddStoryTreeNodeParams,
	RequestAddStoryTreeNodeResult,
	requestGetInheritedGoalContent,
	RequestGetInheritedGoalContentParams,
	RequestGetInheritedGoalContentResult,
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
import { extractFromPak } from "../utils/edge";

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
		connection.onRequest(requestAddStoryTreeNode, this.handleAddStoryTreeNode);
		connection.onRequest(requestOverrideStoryTreeNode, this.handleOverrideStoryTreeNode);

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

	private readonly handleGetStoryTreeNodeChildren = async (
		params: RequestGetStoryTreeNodeChildrenParams
	): Promise<RequestGetStoryTreeNodeChildrenResult> => {
		if (!this.mod) return { children: [] };
		return { children: await this.mod.storyTree.getStoryTreeNodeChildren(params.name) };
	};

	private readonly handleGetStoryTreeNodePath = async (
		params: RequestGetStoryTreeNodePathParams
	): Promise<RequestGetStoryTreeNodePathResult> => {
		if (!this.mod) return { path: null };
		const path = this.mod.getResource(`${params.name}.txt`, "name")?.path;
		return { path: path ? encodePath(path) : path };
	};

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
