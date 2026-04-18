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
import { Resource } from './resource/resource';
import { trimFilePrefix } from '../utils/path/pathUtils';
import { Server } from '../server';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class ModManager extends ComponentBase {
	readonly initializingMods = new Map<string, Promise<Mod>>();
	readonly mods = new Map<string, Mod>();
	private readonly xmlParser = LSXMLParserFactory();
	private readonly orphanedFiles = new Set<TextDocument>();

	constructor(server: Server) {
		super(server);
	}

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
	}

	private handleDidOpen = (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.findResource(trimFilePrefix(decodeURIComponent(event.document.uri)));
		if (file) file.setTextDocument(event.document);
		else this.orphanedFiles.add(event.document);
	};

	private handleDidClose = (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.findResource(trimFilePrefix(decodeURIComponent(event.document.uri)));
		if (file) file.removeTextDocment();
		else this.orphanedFiles.delete(event.document);
	}

	private findResource(path: string): Resource | undefined {
		for (const mod of this.mods.values()) {
			const file = mod.story.getResource(path);
			if (file) return file;
		}
	}

	async createModFromPath(path: string) {
		const meta = this.readModMeta(path);
		if (meta) {
			await this.createMod(meta, path);
		}
	}

	private async createMod(meta: ModMetaModuleInfo, path: string): Promise<Mod> {
		if (meta.uuid in this.mods) {
			return this.mods.get(meta.uuid) as Mod;
		}
		if (!(meta.uuid in this.initializingMods)) {
			const mod = new Mod(meta);
			mod.story.on("storyInitialized", () => {
					for (const file of this.orphanedFiles) {
					const path = this.findResource(trimFilePrefix(decodeURIComponent(file.uri)));
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
