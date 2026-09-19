import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	IdentifierNode,
	RuleNode,
	SignatureNode
} from "../../../parser/ast/nodes";
import { SignatureCollection } from "../../../mods/signature";
import { paramNotBoundDiagnosticFactory } from "../message";

export class ParameterAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		if (!root) return res;
		const signatures = await this.modManager.getAllDefinedSignatures();

		function doAnalysis(node: ASTNode, thisArg: ParameterAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind !== ASTNodeKind.RULE_NODE) doAnalysis(child, thisArg);
				else {
					thisArg.verifyParameterBinding(child as RuleNode, signatures, res);
					thisArg.verifyLocalTypeMatches(child as RuleNode, signatures, res);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	private verifyParameterBinding(rule: RuleNode, signatures: SignatureCollection, res: Diagnostic[]) {
		const boundParameters = new Set<string>(["_"]);
		const functions = [rule.call, ...rule.conditions, ...rule.actions];
		const actionStartIndex = rule.conditions.length + 1;
		for (let i = 0; i < functions.length; i++) {
			const node = functions[i];
			if (node.kind === ASTNodeKind.SIGNATURE_NODE) {
				this.verifyParameterBindingInSignature(
					node as SignatureNode,
					rule,
					signatures,
					boundParameters,
					i,
					actionStartIndex,
					res
				);
			} else {
				this.verifyParameterBindingInComparison(node as ComparisonNode, boundParameters, res);
			}
		}
	}

	private verifyParameterBindingInSignature(
		node: SignatureNode,
		rule: RuleNode,
		signatures: SignatureCollection,
		boundParameters: Set<string>,
		i: number,
		actionStartIndex: number,
		res: Diagnostic[]
	) {
		const signature = signatures.get(node);
		if (!signature || signature.parameters.length !== node.parameters.length) return;
		for (let j = 0; j < signature.parameters.length; j++) {
			const parameterNode = node.parameters[j];
			if (
				parameterNode.content.kind !== ASTNodeKind.IDENTIFIER_NODE ||
				!(parameterNode.content as IdentifierNode).value.startsWith("_")
			)
				continue;
			const isOut = signature.outParamMask
				? ((signature.outParamMask[j >> 3] << (j & 7)) & 0x80) === 0x80
				: false;
			const isDeletion = node.isDeletion;

			// A parameter in an out query slot
			if (isOut && !isDeletion) {
				boundParameters.add((parameterNode.content as IdentifierNode).value);
			} else if (
				// THEN section cannot bind
				i >= actionStartIndex ||
				// NOT does not bind
				isDeletion ||
				// Databases and events always bind
				(signature.type !== "Database" &&
					signature.type !== "Event" &&
					// PROCs and QRYs bind if they are the call
					!(rule.type === "PROC" && i === 0 && signature.type === "Proc") &&
					!(rule.type === "QRY" && i === 0 && signature.type === "UserQuery") &&
					!isOut)
			) {
				if (!boundParameters.has((parameterNode.content as IdentifierNode).value)) {
					res.push(
						paramNotBoundDiagnosticFactory({
							range: parameterNode.selectionRange,
							name: (parameterNode.content as IdentifierNode).value,
							isPlaceholder: false
						})
					);
				} else if ((parameterNode.content as IdentifierNode).value === "_") {
					res.push(
						paramNotBoundDiagnosticFactory({
							range: parameterNode.selectionRange,
							name: (parameterNode.content as IdentifierNode).value,
							isPlaceholder: true
						})
					);
				}
			} else {
				if (i < actionStartIndex && !isDeletion) {
					boundParameters.add((parameterNode.content as IdentifierNode).value);
				}
			}
		}
	}

	private verifyParameterBindingInComparison(node: ComparisonNode, boundParameters: Set<string>, res: Diagnostic[]) {
		for (const operand of node.getNodeChildren()) {
			if (operand?.kind !== ASTNodeKind.IDENTIFIER_NODE) continue;
			if ((operand as IdentifierNode).value.startsWith("_")) {
				if ((operand as IdentifierNode).value === "_") {
					res.push(
						paramNotBoundDiagnosticFactory({
							range: operand.selectionRange,
							name: (operand as IdentifierNode).value,
							isPlaceholder: true
						})
					);
				} else if (!boundParameters.has((operand as IdentifierNode).value)) {
					res.push(
						paramNotBoundDiagnosticFactory({
							range: operand.selectionRange,
							name: (operand as IdentifierNode).value,
							isPlaceholder: false
						})
					);
				}
			}
		}
	}

	private verifyLocalTypeMatches(node: RuleNode, signatures: SignatureCollection, res: Diagnostic[]) {
		const signature = signatures.get(node.call);
		if (!signature || signature.parameters.length !== node.call.parameters.length) return;
		for (let i = 0; i < signature.parameters.length; i++) {
			if (node.call.parameters[i].type && node.call.parameters[i].type?.value !== signature.parameters[i]) {
				res.push({ range: node.call.selectionRange, message: "bad signature type" });
			}
		}
	}
}
