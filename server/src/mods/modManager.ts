import { Connection, TextDocumentChangeEvent } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { Mod } from "./mod";
import { dirname, join } from "path";
import {
	collectAttributes,
	findNodeChild,
	findRegion,
	findRegionChild,
	getNodeChildren,
	LSXMLParserFactory,
	ParseLSXML
} from "../utils/lsXML/lsXML";
import {
	ModMetaModuleInfo,
	ModMetaModuleShortDesc,
	ModMetaPublishVersion,
	ModMetaScript,
	ModMetaScriptParameter
} from "./modMeta";
import { existsSync, readdirSync } from "fs";
import { Resource } from "./resource/resource";
import { decodePath, trimFilePrefix } from "../utils/path/pathUtils";
import { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Server component that manages mod loading and tracking.
 */
export class ModManager extends ComponentBase {
	readonly initializingMods = new Map<string, Promise<Mod>>();
	readonly mods = new Map<string, Mod>();
	private readonly xmlParser = LSXMLParserFactory();
	private readonly orphanedFiles = new Set<TextDocument>();

	initializeComponent(connection: Connection): void {
		connection.workspace.getWorkspaceFolders().then(
			(folders) => {
				if (folders) {
					for (const folder of folders) {
						let path = decodeURIComponent(folder.uri);
						path = trimFilePrefix(path);
						this.createModFromPath(path);
					}
				}
			},
			(reason) => {
				console.error(reason);
			}
		);

		const { documents } = this.server;
		documents.onDidOpen(this.handleDidOpen);
		documents.onDidClose(this.handleDidClose);
		documents.onDidChangeContent(this.handleDidChangeContent);
	}

	private handleDidOpen = (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.findResource(decodePath(event.document.uri));
		if (file) file.setTextDocument(event.document);
		else this.orphanedFiles.add(event.document);
	};

	private handleDidClose = (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.findResource(decodePath(event.document.uri));
		if (file) file.removeTextDocment();
		else this.orphanedFiles.delete(event.document);
	};

	private handleDidChangeContent = (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.findResource(decodePath(event.document.uri));
		if (file) file.valid = false;
	};

	/**
	 * Locates a {@link Resource} associated with a given path.
	 *
	 * @param path The path of the {@link Resource} to find. It is recommended to normalize the path first.
	 * @returns The {@link Resource} pointed to by the path, or `undefined` if it does not exist.
	 */
	findResource(path: string): Resource | undefined {
		for (const mod of this.mods.values()) {
			const file = mod.story.getResource(path);
			if (file) return file;
		}
	}

	getAllResources(path: string): Resource[] {
		const mod = this.findResource(decodePath(path))?.story.mod;
		if (mod) {
			return mod.story.getAllResources();
		}
		return [];
	}

	/**
	 * Loads a mod from a given path.
	 *
	 * @param path The path of the mod to load. Should contain the mod's meta.lsx.
	 */
	async createModFromPath(path: string) {
		const meta = this.readModMeta(path);
		if (meta) {
			await this.createMod(meta, path);
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
		if (meta.uuid in this.mods) {
			return this.mods.get(meta.uuid) as Mod;
		}
		if (!(meta.uuid in this.initializingMods)) {
			const mod = new Mod(meta, path);
			mod.story.on("storyInitialized", () => {
				for (const file of this.orphanedFiles) {
					const path = this.findResource(decodePath(file.uri));
					if (path) {
						path.setTextDocument(file);
						this.orphanedFiles.delete(file);
					}
				}
			});
			const initializer = async (thisArg: ModManager) => {
				await mod.initialize(path);
				thisArg.initializingMods.delete(meta.uuid);
				thisArg.mods.set(meta.uuid, mod);
				return mod;
			};
			this.initializingMods.set(meta.uuid, initializer(this));
		}

		for (const dependency of this.findDependencies(meta, path)) {
			this.createModFromPath(dependency);
		}
		return this.initializingMods.get(meta.uuid) as Promise<Mod>;
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
