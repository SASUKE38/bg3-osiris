import { Diagnostic, Location } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNode, ASTNodeKind, RuleNode } from "../../../parser/ast/nodes";

export class UnknownSymbolAnalyzer extends AnalyzerBase {
	unresolvedSymbols = new Map<string, Location[]>();

	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const document = this.resource.getTextDocument();
		const root = await this.resource.getRootNode();
		const { calledSignatureToFileMap } = this.modManager;
		const { fileToCalledSignatureMap } = this.modManager;
		const signatures = await this.modManager.getAllDefinedSignatures();

		function doAnalysis(thisArg: UnknownSymbolAnalyzer, node?: ASTNode) {
			if (!node) return;
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.RULE_NODE) {
					for (const signature of (child as RuleNode).actions) {
						if (
							signatures.has(signature.name) &&
							signatures.get(signature.name)?.definitions.length !== 0
						) {
							thisArg.unresolvedSymbols.delete(signature.name);
						} else {
							if (thisArg.unresolvedSymbols.has(signature.name)) {
								thisArg.unresolvedSymbols
									.get(signature.name)
									?.push({ uri: document.uri, range: signature.range });
							} else {
								thisArg.unresolvedSymbols.set(signature.name, [
									{ uri: document.uri, range: signature.range }
								]);
							}
							res.push({
								message: "Unresolved symbol",
								range: signature.range
							});
						}
					}
				}

				doAnalysis(thisArg, child);
			}
		}

		doAnalysis(this, root);
		return res;
	}
}
