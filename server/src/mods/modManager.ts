import { Connection } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { Mod } from "./mod";
import { readFileSync } from "fs";
import { join } from "path";
import {
	collectAttributes,
	findNodeChild,
	findRegion,
	findRegionChild,
	getNodeChildren,
	LSXMLParserFactory
} from "../utils/lsXML/lsXML";
import {
	ModMetaModuleInfo,
	ModMetaModuleShortDesc,
	ModMetaPublishVersion,
	ModMetaScript,
	ModMetaScriptParameter
} from "./modMeta";

export class ModManager extends ComponentBase {
	readonly mods: Mod[] = [];
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
						this.createMod(path);
					}
				}
			},
			(reason) => {
				console.error(reason);
			}
		);
	}

	createMod(path: string) {
		this.readModMeta(path);
	}

	readModMeta(path: string): ModMetaModuleInfo {
		const meta: Partial<ModMetaModuleInfo> = {};
		meta.dependencies = [];
		meta.scripts = [];
		try {
			const rootNode = findRegionChild(
				findRegion(this.xmlParser.parse(readFileSync(join(path, "meta.lsx"), { encoding: "utf-8" })), "Config"),
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
		} catch (e) {
			console.error(e);
		}
		return meta as ModMetaModuleInfo;
	}
}
