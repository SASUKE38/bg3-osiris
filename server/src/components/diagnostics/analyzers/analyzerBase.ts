import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Resource } from "../../../mods/resource/resource";
import { ModManager } from "../../modManager";

export abstract class AnalyzerBase {
	resource: Resource;
	modManager: ModManager;

	constructor(resource: Resource, modManager: ModManager) {
		this.resource = resource;
		this.modManager = modManager;
	}

	abstract analyze(): Promise<Diagnostic[]>;
}
