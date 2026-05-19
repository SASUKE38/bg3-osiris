import { Diagnostic, Location } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNode, ASTNodeKind, RuleNode } from "../../../parser/ast/nodes";
import { ModManager } from "../../modManager";
import { TextDocument } from "vscode-languageserver-textdocument";

export class UnknownSymbolAnalyzer extends AnalyzerBase {
	private readonly modManager;
	unresolvedSymbols = new Map<string, Location[]>();

	constructor(document: TextDocument, modManager: ModManager) {
		super(document);
		this.modManager = modManager;
	}

	analyze(root: ASTNode): Diagnostic[] {
		const res: Diagnostic[] = [];
		const { calledSignatureToFileMap } = this.modManager;
		const { fileToCalledSignatureMap } = this.modManager;
		const { definedSignatures } = this.modManager;
		const definitions = new Set<string>();
		definedSignatures.forEach((set) => {
			set.forEach((definition) => {
				definitions.add(definition);
			});
		});

		function doAnalysis(node: ASTNode, thisArg: UnknownSymbolAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.RULE_NODE) {
					for (const signature of (child as RuleNode).actions) {
						if (definitions.has(signature.name)) {
							thisArg.unresolvedSymbols.delete(signature.name);
						} else {
							if (thisArg.unresolvedSymbols.has(signature.name)) {
								thisArg.unresolvedSymbols
									.get(signature.name)
									?.push({ uri: thisArg.document.uri, range: signature.range });
							} else {
								thisArg.unresolvedSymbols.set(signature.name, [
									{ uri: thisArg.document.uri, range: signature.range }
								]);
							}
							res.push({
								message: "Unresolved symbol",
								range: signature.range
							});
						}
					}
				}

				doAnalysis(child, thisArg);
			}
		}

		doAnalysis(root, this);
		return res;
	}
}
