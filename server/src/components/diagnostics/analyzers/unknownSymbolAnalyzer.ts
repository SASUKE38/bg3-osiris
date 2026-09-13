import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNode, ASTNodeKind, SignatureNode } from "../../../parser/ast/nodes";
import { SignatureCollection } from "../../../mods/signature";
import { unresolvedSymbolDiagnosticFactory } from "../message";

export class UnknownSymbolAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		if (!root) return res;

		const { calledSignatureToFileMap } = this.modManager;
		const { fileToCalledSignatureMap } = this.modManager;
		const signatures = await this.modManager.getAllDefinedSignatures();

		function doAnalysis(node: ASTNode, thisArg: UnknownSymbolAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind !== ASTNodeKind.SIGNATURE_NODE) doAnalysis(child, thisArg);
				else thisArg.verifyResolvedSymbol(child as SignatureNode, signatures, res);
			}
		}

		doAnalysis(root, this);
		return res;
	}

	// UnresolvedSymbol 19
	verifyResolvedSymbol(signature: SignatureNode, signatures: SignatureCollection, res: Diagnostic[]) {
		if (!signatures.has(signature)) {
			res.push(unresolvedSymbolDiagnosticFactory({ range: signature.range, signature }));
		}
	}
}
