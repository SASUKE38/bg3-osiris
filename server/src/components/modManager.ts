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
import { existsSync } from "fs";
import { Resource } from "../mods/resource/resource";
import { decodePath } from "../utils/pathUtils";
import { Signature } from "../mods/signature";
import { isArrayEqual } from "../utils/isArrayEqual";
import { Dependency } from "../mods/dependency";

/**
 * Server component that manages mod loading and tracking.
 */
export class ModManager extends ComponentBase {
	mod?: Mod;

	readonly baseMods = ["Shared", "SharedDev", "Gustav", "GustavDev"];

	calledSignatureToFileMap = new Map<string, Set<string>>();
	fileToCalledSignatureMap = new Map<string, Set<string>>();
	definedSignatureToFileMap = new Map<string, Set<string>>();
	fileToDefinedSignatureMap = new Map<string, Set<string>>();

	private readonly xmlParser = LSXMLParserFactory();

	async initializeComponent(connection: Connection): Promise<void> {
		const { rootFolder } = this.server;
		connection.workspace.onDidDeleteFiles(this.handleDeleteFiles);
		connection.workspace.onDidCreateFiles(this.handleCreateFiles);

		if (rootFolder) {
			this.mod = (await this.createModFromPath(decodePath(rootFolder.uri))) as Mod;

			if (this.mod) {
				await Promise.all(
					Array.from(this.mod.getAllExternalGoals()).map((value) => {
						value.load();
					})
				);

				this.mod.storyTree.createTree([...this.mod.getAllGoals(), ...this.mod.getAllExternalGoals()]);

				for (const resource of this.mod.getAllGoals()) {
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

	async getAllDefinedSignatures(): Promise<Map<string, Signature>> {
		const res = new Map<string, Signature>();
		const activeFiles = this.mod?.getAllExternalGoals();
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
	async createModFromPath(path: string, isDependency?: boolean): Promise<Dependency | undefined> {
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
	private async createMod(path: string, meta?: ModMetaModuleInfo, isDependency?: boolean): Promise<Dependency> {
		const mod = isDependency ? new Dependency(path, this, meta) : new Mod(path, this, meta);
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
		if (this.baseMods.find((value) => path.endsWith(value))) return undefined;

		if (!existsSync(path)) {
			console.error(`Couldn't find meta.lsx for ${path}`);
		} else {
			try {
				const meta: Partial<ModMetaModuleInfo> = {};
				meta.dependencies = [];
				meta.scripts = [];
				const rootNode = findRegionChild(findRegion(ParseLSXML(this.xmlParser, path), "Config"), "root");

				const moduleInfo = findNodeChild(rootNode, "ModuleInfo");
				if (!moduleInfo) {
					throw new Error("");
				}
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
		return undefined;
	}
}
