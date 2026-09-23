import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	IdentifierNode,
	NumberNode,
	NumberNodeKind,
	RuleNode,
	SignatureNode,
	SignatureSectionNode
} from "../../../parser/ast/nodes";
import { SignatureCollection } from "../../../mods/signature";
import { localTypeMismatchDiagnosticFactory, paramNotBoundDiagnosticFactory, unresolvedSignatureDiagnosticFactory } from "../message";

export class ParameterAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		if (!root) return res;
		const signatures = await this.modManager.getAllDefinedSignatures();

		function doAnalysis(node: ASTNode, thisArg: ParameterAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.RULE_NODE) {
					thisArg.verifyParameterBinding(child as RuleNode, signatures, res);
					thisArg.verifyConstantTypes([(child as RuleNode).call, ...(child as RuleNode).conditions.filter((value) => value.kind === ASTNodeKind.SIGNATURE_NODE) as SignatureNode[], ...(child as RuleNode).actions], signatures, res);
				} else if (child.kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
					thisArg.verifyConstantTypes((child as SignatureSectionNode).content, signatures, res);
				} else {
					doAnalysis(child, thisArg);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	// TODO: Figure out types for comparisons
	// ParamNotBound 24
	private verifyParameterBinding(rule: RuleNode, signatures: SignatureCollection, res: Diagnostic[]) {
		const parameters = new Map<string, string>([["_", "UNKNOWN"]]);
		const functions = [rule.call, ...rule.conditions, ...rule.actions];
		const actionStartIndex = rule.conditions.length + 1;
		for (let i = 0; i < functions.length; i++) {
			const node = functions[i];
			if (node.kind === ASTNodeKind.SIGNATURE_NODE) {
				this.verifyParameterBindingInSignature(
					node as SignatureNode,
					rule,
					signatures,
					parameters,
					i,
					actionStartIndex,
					res
				);
				this.verifyVariableTypes(node as SignatureNode, signatures, parameters, res);
			} else {
				this.verifyParameterBindingInComparison(node as ComparisonNode, parameters, res);
			}
		}
	}

	private verifyParameterBindingInSignature(
		node: SignatureNode,
		rule: RuleNode,
		signatures: SignatureCollection,
		parameters: Map<string, string>,
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
				parameters.set((parameterNode.content as IdentifierNode).value, parameterNode.type ? parameterNode.type.value : signature.parameters[j]);
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
				if (!parameters.has((parameterNode.content as IdentifierNode).value)) {
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
					parameters.set((parameterNode.content as IdentifierNode).value, parameterNode.type ? parameterNode.type.value : signature.parameters[j]);
				}
			}
		}
	}

	private verifyParameterBindingInComparison(
		node: ComparisonNode,
		boundParameters: Map<string, string>,
		res: Diagnostic[]
	) {
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

	// LocalTypeMismatch 11
	private verifyVariableTypes(
		node: SignatureNode,
		signatures: SignatureCollection,
		parameters: Map<string, string>,
		res: Diagnostic[]
	) {
		const signature = signatures.get(node);
		if (!signature || signature.parameters.length != node.parameters.length) return;
		for (let j = 0; j < signature.parameters.length; j++) {
			if (
				node.parameters[j].content.kind !== ASTNodeKind.IDENTIFIER_NODE ||
				(node.parameters[j].content as IdentifierNode).value === "_"
			)
				continue;
			const actualParameter = node.parameters[j];
			const expectedParameter = signature.parameters[j];
			if (!(actualParameter.content as IdentifierNode).value.startsWith("_")) continue;
			if (expectedParameter === "") {
				res.push(unresolvedSignatureDiagnosticFactory({range: node.selectionRange, name: node.name}));
				return; 
			}

			const boundType = parameters.get((actualParameter.content as IdentifierNode).value);
			if (!boundType) continue;
			const { mod } = this.modManager;
			if (!mod) continue;

			const actualType = actualParameter.type ? actualParameter.type.value : boundType;
			const typeA = mod.inheritedTypes.get(actualType);
			const typeB = mod.inheritedTypes.get(expectedParameter);
			if (!typeA || !typeB) continue;

			if (!mod.areAliasTypes(typeA, typeB)) {
				if (actualParameter.type) {
					res.push(localTypeMismatchDiagnosticFactory({range: actualParameter.type.selectionRange, actualName: actualType, expectedName: expectedParameter}))
				} else {
					res.push(localTypeMismatchDiagnosticFactory({range: actualParameter.selectionRange, actualName: typeA.name, expectedName: expectedParameter}))
				}
			}
		}
	}

	private verifyConstantTypes(signatureNodes: SignatureNode[], signatures: SignatureCollection, res: Diagnostic[]) {
		for (const node of signatureNodes) {
			if (node.kind === ASTNodeKind.SIGNATURE_NODE) {
				const signature = signatures.get(node as SignatureNode);
				if (!signature || signature.parameters.length !== (node as SignatureNode).parameters.length) return;

				for (let i = 0; i < (node as SignatureNode).parameters.length; i++) {
					const parameterNode = (node as SignatureNode).parameters[i];
					
					if (signature.parameters[i] === "") {
						res.push(unresolvedSignatureDiagnosticFactory({range: node.selectionRange, name: node.name}));
						return; 
					}

					let searchType = "UNKNOWN";

					if (parameterNode.type) {
						searchType = parameterNode.type.value;
					} else {
						switch (parameterNode.content.kind) {
							case ASTNodeKind.IDENTIFIER_NODE:
								if ((parameterNode.content as IdentifierNode).value.startsWith("_")) continue;
								searchType = "GUIDSTRING";
								break;
							case ASTNodeKind.STRING_NODE:
								searchType = "STRING";
								break;
							case ASTNodeKind.NUMBER_NODE:
								if ((parameterNode.content as NumberNode).numberKind === NumberNodeKind.Integer) searchType = "INTEGER"
								if ((parameterNode.content as NumberNode).numberKind === NumberNodeKind.Integer64) searchType = "INTEGER64"
								if ((parameterNode.content as NumberNode).numberKind === NumberNodeKind.Real) searchType = "REAL"
								break;
						}
					}

					const { mod } = this.modManager;
					const typeA = mod?.inheritedTypes.get(searchType);
					const typeB = mod?.inheritedTypes.get(signature.parameters[i]);
					if (!mod || !typeA || !typeB) continue;
					if (!mod.areAliasTypes(typeA, typeB)) {
						res.push(localTypeMismatchDiagnosticFactory({range: parameterNode.type ? parameterNode.type.selectionRange : parameterNode.selectionRange, actualName: searchType, expectedName: signature.parameters[i]}))
					}
				}
			} else {

			}
		}
	}
}
