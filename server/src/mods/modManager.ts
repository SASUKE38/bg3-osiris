import { Connection } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { Mod } from "./mod";
import { join } from "path";
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

export class ModManager extends ComponentBase {
	readonly initializingMods: Map<string, Promise<Mod>> = new Map<string, Promise<Mod>>();
	readonly mods: Map<string, Mod> = new Map<string, Mod>();
	private readonly xmlParser = LSXMLParserFactory();

	initializeComponent(connection: Connection): void {
		connection.workspace.getWorkspaceFolders().then(
			(folders) => {
				if (folders) {
					for (const folder of folders) {
						let path = decodeURIComponent(folder.uri);
						if (path.startsWith("file:///")) {
							path = path.substring(8);
						}
						this.createModFromPath(path);
					}
				}
			},
			(reason) => {
				console.error(reason);
			}
		);
	}

	async createModFromPath(path: string) {
		const meta = this.readModMeta(path);
		if (meta) {
			await this.createMod(meta);
		}
	}

	private async createMod(meta: ModMetaModuleInfo): Promise<Mod> {
		if (meta.uuid in this.mods) {
			return this.mods.get(meta.uuid) as Mod;
		}
		if (!(meta.uuid in this.initializingMods)) {
			const mod = new Mod(meta);
			const initializer = async(manager: ModManager) => {
				await mod.initialize();
				manager.initializingMods.delete(meta.uuid);
				manager.mods.set(meta.uuid, mod);
				return mod;
			}
			this.initializingMods.set(meta.uuid, initializer(this));
		}

		return this.initializingMods.get(meta.uuid) as Promise<Mod>;
	}

	private readModMeta(path: string): ModMetaModuleInfo | undefined {
		try {
			const meta: Partial<ModMetaModuleInfo> = {};
			meta.dependencies = [];
			meta.scripts = [];
			const rootNode = findRegionChild(
				findRegion(ParseLSXML(this.xmlParser, join(path, "meta.lsx")), "Config"),
				"root"
			);

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
		return undefined;
	}
}
