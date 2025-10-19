import { ExtensionContext } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

export abstract class ComponentBase {
	context: ExtensionContext;
	constructor(context: ExtensionContext) {
		this.context = context;
	}

	initializeComponent?(connection: LanguageClient): void;
}
