import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNode, ASTNodeKind, SignatureNode } from "../../../parser/ast/nodes";
import { Signature } from "../../../mods/signature";
import { unusedDatabaseWarningDiagnosticFactory } from "../message";

export class SignatureAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		const signatures = await this.modManager.getAllDefinedSignatures();
		if (!root) return res;

		function doAnalysis(node: ASTNode, thisArg: SignatureAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.SIGNATURE_NODE) {
					if (signatures.has((child as SignatureNode).name)) {
						const signature = signatures.get((child as SignatureNode).name) as Signature;
						if (signature.type === "database") {
							if (signature.reads.length === 0 && signature.writes.length > 0) {
								res.push(
									unusedDatabaseWarningDiagnosticFactory({
										signature: child as SignatureNode,
										isRead: false
									})
								);
							} else if (signature.writes.length === 0 && signature.reads.length > 0) {
								res.push(
									unusedDatabaseWarningDiagnosticFactory({
										signature: child as SignatureNode,
										isRead: true
									})
								);
							}
						}
					}
				} else {
					doAnalysis(child, thisArg);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}
}
