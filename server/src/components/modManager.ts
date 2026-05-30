import { Connection, CreateFilesParams, DeleteFilesParams, Range, ServerCapabilities } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { Mod } from "../mods/mod";
import { dirname, join } from "path";
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
import { existsSync, readdirSync } from "fs";
import { Resource } from "../mods/resource/resource";
import { decodePath } from "../utils/pathUtils";
import { Signature } from "../mods/signature";
import { isArrayEqual } from "../utils/isArrayEqual";

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

		if (rootFolder) {
			this.mod = await this.createModFromPath(decodePath(rootFolder.uri));
			if (this.mod) {
				for (const resource of this.mod.getAllResources()) {
					this.server.diagnosticManager.handleDiagnostics(resource.getTextDocument());
				}
			}
		}
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
			return this.mod.getAllResources();
		}
		return [];
	}

	async getAllDefinedSignatures(): Promise<Map<string, Signature>> {
		const res = new Map<string, Signature>();
		for (const resource of this.getAllResources()) {
			for (const signature of (await resource.getData("signatures")).values()) {
				if (res.has(signature.name)) {
					const entrySignature = res.get(signature.name) as Signature;
					entrySignature.definitions = [...entrySignature.definitions, ...signature.definitions];
					entrySignature.calls = [...entrySignature.calls, ...signature.calls];
					entrySignature.reads = [...entrySignature.reads, ...signature.reads];
					entrySignature.writes = [...entrySignature.writes, ...signature.writes];
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
	async createModFromPath(path: string): Promise<Mod | undefined> {
		const meta = this.readModMeta(path);
		if (meta) {
			return await this.createMod(meta, path);
		}
	}

	/**
	 * Loads a mod from a given path and {@link ModMetaModuleInfo}.
	 *
	 * @param meta The {@link ModMetaModuleInfo} of the mod to load.
	 * @param path The path to the mod directory to load. Should contain the mod's meta.lsx.
	 * @returns The loaded {@link Mod}.
	 */
	private async createMod(meta: ModMetaModuleInfo, path: string): Promise<Mod> {
		const mod = new Mod(meta, path, this);
		await mod.initialize();
		return Promise.resolve(mod);
	}

	/**
	 * Gets an array of paths to a mod's dependencies.
	 *
	 * @param meta The {@link ModMetaModuleInfo} of the mod whose dependencies should be loaded.
	 * @param path The path to the mod directory whose dependencies should be loaded.
	 * Should contain the mod's meta.lsx.
	 * @returns An array of dependency folders.
	 */
	private findDependencies(meta: ModMetaModuleInfo, path: string): string[] {
		// try to find folder by exhaustively searching meta.lsx files for the right one?
		const res: string[] = [];
		if (meta.dependencies) {
			const modDir = dirname(path);
			const contents = readdirSync(modDir);
			for (const dependency of meta.dependencies) {
				let dependencyFolder;
				dependencyFolder = contents.find((item) => {
					return dependency.name + "_" + dependency.uuid === item;
				});
				if (!dependencyFolder) {
					dependencyFolder = contents.find((item) => {
						return dependency.uuid === item;
					});
				}
				if (!dependencyFolder) {
					dependencyFolder = contents.find((item) => {
						return dependency.name === item;
					});
				}
				if (!dependencyFolder) {
					console.error(`Couldn't find dependency ${dependency.name} for ${meta.name}`);
					continue;
				}
				res.push(join(modDir, dependencyFolder));
			}
		}
		return res;
	}

	/**
	 * Retrieves metadata associated with a given mod directory.
	 *
	 * @param path The path to the mod whose metadata should be loaded. Should contain the mod's meta.lsx.
	 * @returns The mod's metadata as an {@link ModMetaModuleInfo}.
	 */
	private readModMeta(path: string): ModMetaModuleInfo | undefined {
		const metaPath = join(path, "meta.lsx");
		if (!existsSync(metaPath)) {
			console.error(`Couldn't find meta.lsx for ${path}`);
		} else {
			try {
				const meta: Partial<ModMetaModuleInfo> = {};
				meta.dependencies = [];
				meta.scripts = [];
				const rootNode = findRegionChild(findRegion(ParseLSXML(this.xmlParser, metaPath), "Config"), "root");

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
