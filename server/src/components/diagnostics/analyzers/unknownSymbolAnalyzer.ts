import { Diagnostic, Position, Range } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNode, ASTNodeKind, SignatureNode, StringNode } from "../../../parser/ast/nodes";
import { SignatureCollection } from "../../../mods/signature";
import {
	unexpectedNewlineInStringDiagnosticFactory,
	unresolvedSymbolDiagnosticFactory,
	unresolvedTypeDiagnosticFactory
} from "../message";

export class UnknownSymbolAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		if (!root) return res;

		const signatures = await this.modManager.getAllDefinedSignatures();

		function doAnalysis(node: ASTNode, thisArg: UnknownSymbolAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind !== ASTNodeKind.SIGNATURE_NODE) doAnalysis(child, thisArg);
				else {
					thisArg.verifyResolvedSymbol(child as SignatureNode, signatures, res);
					thisArg.verifyResolvedType(child as SignatureNode, res);
					thisArg.verifyNoNewlineInString(child as SignatureNode, res);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	// UnresolvedSymbol 19
	private verifyResolvedSymbol(signature: SignatureNode, signatures: SignatureCollection, res: Diagnostic[]) {
		if (!signatures.has(signature)) {
			res.push(unresolvedSymbolDiagnosticFactory({ range: signature.range, signature }));
		}
	}

	// UnresolvedType 12
	private verifyResolvedType(signature: SignatureNode, res: Diagnostic[]) {
		const { mod } = this.modManager;
		if (!mod) return;
		for (const parameterNode of signature.parameters) {
			if (!parameterNode.type || mod.inheritedTypes.has(parameterNode.type.value)) continue;
			res.push(
				unresolvedTypeDiagnosticFactory({ range: parameterNode.type.range, typeName: parameterNode.type.value })
			);
		}
	}

	// UnexpectedNewlineInString 39
	private verifyNoNewlineInString(signature: SignatureNode, res: Diagnostic[]) {
		for (const parameterNode of signature.parameters) {
			if (parameterNode.content.kind !== ASTNodeKind.STRING_NODE) continue;
			const content = parameterNode.content as StringNode;
			if (content.value.endsWith("\n")) {
				const endLine = content.range.end.line - 1;
				const endCharacter = content.range.start.character + content.value.length;
				const range = Range.create(
					Position.create(endLine, endCharacter - 2),
					Position.create(endLine, endCharacter - 1)
				);
				res.push(unexpectedNewlineInStringDiagnosticFactory({ range }));
			}
		}
	}
}
