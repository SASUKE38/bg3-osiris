import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNode, ASTNodeKind, RuleNode } from "../../../parser/ast/nodes";
import { invalidProcDefinitionDiagnosticFactory, invalidSymbolInStatementDiagnosticFactory } from "../message";
import { Signature } from "../../../mods/signature";
import { InheritedSignature } from "../../../mods/mod";

export class RuleAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		const signatures = await this.modManager.getAllDefinedSignatures();
		const inheritedSignatures = this.modManager.mod?.getAllInheritedSignatures();
		if (!root) return res;

		function verifyRuleSegment(
			verifier: (
				node: RuleNode,
				signatures: Map<string, Signature>,
				inheritedSignatures?: Map<string, InheritedSignature[]>
			) => Diagnostic | undefined,
			node: RuleNode
		) {
			const result = verifier(node, signatures, inheritedSignatures);
			if (result) res.push(result);
		}

		function doAnalysis(node: ASTNode, thisArg: RuleAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind !== ASTNodeKind.RULE_NODE) doAnalysis(child, thisArg);
				else {
					verifyRuleSegment(thisArg.verifyProcDefinition, child as RuleNode);
					verifyRuleSegment(thisArg.verifySymbolsInStatement, child as RuleNode);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	// InvalidProcDefinition 13
	private verifyProcDefinition(
		rule: RuleNode,
		signatures: Map<string, Signature>,
		inheritedSignatures?: Map<string, InheritedSignature[]>
	): Diagnostic | undefined {
		if (rule.type !== "PROC" && rule.type !== "QRY") return;
		const signature = signatures.get(rule.call.name);
		const inheritedSignature = inheritedSignatures?.get(rule.call.name);
		if (signature) {
			if (
				(rule.type === "PROC" && signature.type !== "proc") ||
				(rule.type === "QRY" && signature.type !== "query")
			) {
				return invalidProcDefinitionDiagnosticFactory({ type: rule.type, range: rule.call.range });
			}
		} else if (inheritedSignature) {
			if (!rule.call.name.startsWith(`${rule.type}_`)) {
				return invalidProcDefinitionDiagnosticFactory({ type: rule.type, range: rule.call.range });
			}
		}
	}

	// InvalidSymbolInStatement 15
	private verifySymbolsInStatement(
		rule: RuleNode,
		signatures: Map<string, Signature>,
		inheritedSignatures?: Map<string, InheritedSignature[]>
	): Diagnostic | undefined {
		for (const action of rule.actions) {
			const signature = signatures.get(action.name);
			const inheritedSignature = inheritedSignatures?.get(action.name);
			if (signature?.type === "query" || signature?.type === "unknown") {
				return invalidSymbolInStatementDiagnosticFactory({
					name: action.name,
					type: signature.type,
					range: action.selectionRange
				});
			} else if (inheritedSignature && inheritedSignature[0].name.startsWith("QRY_")) {
				return invalidSymbolInStatementDiagnosticFactory({
					name: action.name,
					type: "query",
					range: action.selectionRange
				});
			}
		}
	}
}
