import { PrepareRenameParams, Range, ReferenceParams } from "vscode-languageserver";
import { SignatureCollection } from "../mods/signature";
import { ASTNode, ASTNodeKind, IdentifierNode, RuleNode, SignatureNode } from "../parser/ast/nodes";
import { GoalResource } from "../mods/resource/goalResource";

export function getParameterBinding(ruleNode: RuleNode, searchNode: IdentifierNode, signatures: SignatureCollection) {
	const signatureNodes = [
		ruleNode.call,
		...(ruleNode.conditions.filter((value) => value.kind === ASTNodeKind.SIGNATURE_NODE) as SignatureNode[])
	];
	for (let i = 0; i < signatureNodes.length; i++) {
		const signature = signatures.get(signatureNodes[i]);
		const ruleType = ruleNode.type;
		if (!signature) continue;
		for (let j = 0; j < signatureNodes[i].parameters.length; j++) {
			const parameter = signatureNodes[i].parameters[j];
			if (
				parameter.content.kind !== ASTNodeKind.IDENTIFIER_NODE ||
				(parameter.content as IdentifierNode).value !== searchNode.value
			)
				continue;
			const isOut = signature.isOutParameter(j);
			const isDeletion = signatureNodes[i].isDeletion;

			if (
				(isOut && !isDeletion) ||
				signature.type === "Database" ||
				signature.type === "Event" ||
				(i === 0 && ruleType === "PROC" && signature.type === "Proc") ||
				(i === 0 && ruleType === "QRY" && signature.type === "UserQuery")
			) {
				return {
					signature: signature,
					bindingIndex: j,
					parameterNode: parameter
				};
			}
		}
	}
}

/**
 * Searches recursively for instances of a child node.
 *
 * @param root The root {@link ASTNode} to search in.
 * @param searchNode The {@link SignatureNode} or {@link IdentifierNode} to look for.
 * @returns An {@link Array} of {@link Range} instances that represent the positions of discovered symbols.
 */
export function findNestedUses(root: ASTNode, searchNode: SignatureNode | IdentifierNode): Range[] {
	const res: Range[] = [];

	function doTraversal(node: ASTNode) {
		for (const child of node.getNodeChildren()) {
			if (!child) continue;
			if (
				(child.kind === ASTNodeKind.SIGNATURE_NODE &&
					searchNode.kind === ASTNodeKind.SIGNATURE_NODE &&
					(child as SignatureNode).name === (searchNode as SignatureNode).name) ||
				(child.kind === ASTNodeKind.IDENTIFIER_NODE &&
					searchNode.kind === ASTNodeKind.IDENTIFIER_NODE &&
					(child as IdentifierNode).value === (searchNode as IdentifierNode).value)
			) {
				res.push(child.selectionRange);
			} else {
				doTraversal(child);
			}
		}
	}

	doTraversal(root);
	return res;
}

/**
 * Finds instances of a variable within a given node's children. It is assumed that the given node contains
 * a rule.
 *
 * @param nodesAt The {@link Array} of nodes to search.
 * @param searchNode The node to search for.
 * @returns An {@link Array} of {@link Range} instances that represent the positions of discovered variables.
 */
export function findVariableUses(nodesAt: ASTNode[], searchNode: IdentifierNode): Range[] {
	const res: Range[] = [];
	let ruleNode: RuleNode | undefined;

	for (let i = nodesAt.length - 1; i >= 0; i--) {
		if (nodesAt[i].kind === ASTNodeKind.RULE_NODE) {
			ruleNode = nodesAt[i] as RuleNode;
			break;
		}
	}

	if (!ruleNode) return res;
	for (const signature of [
		ruleNode.call,
		...(ruleNode.conditions.filter((value) => value.kind === ASTNodeKind.SIGNATURE_NODE) as SignatureNode[]),
		...ruleNode.actions
	]) {
		for (const parameter of signature.parameters) {
			if (
				parameter.content.kind === ASTNodeKind.IDENTIFIER_NODE &&
				(parameter.content as IdentifierNode).value === searchNode.value
			) {
				res.push(parameter.content.selectionRange);
			}
		}
	}

	return res;
}

/**
 * Determines if the given attempt to rename a symbol or finding its references is valid. That is, determines
 * if the request's position is over the symbol's name. Builtin signatures are optionally forbidden.
 *
 * @param params The {@link PrepareRenameParams} or {@link ReferenceParams} to examine.
 * @param resource The {@link GoalResource} that contains the request.
 * @param signatures If provided, the collection to use to filter out builtin signatures.
 * @returns A {@link Range} instance if the given parameters contain a valid position or null otherwise.
 */
export async function validateRenameOrReferences(
	params: PrepareRenameParams | ReferenceParams,
	resource: GoalResource,
	signatures?: SignatureCollection
): Promise<Range | null> {
	const nodesAt = await resource.getNodesAt(params.position);
	if (nodesAt.length <= 1) return null;
	const node = nodesAt[nodesAt.length - 1];

	const document = resource.getTextDocument();

	const positionOffset = document.offsetAt(params.position);
	const selectionRange = node.selectionRange;
	const selectionRangeOffsetStart = document.offsetAt(selectionRange.start);
	const selectionRangeOffsetEnd = document.offsetAt(selectionRange.end);
	if (positionOffset > selectionRangeOffsetEnd || positionOffset < selectionRangeOffsetStart) return null;

	const nodeKind = node.kind;
	if (nodeKind === ASTNodeKind.IDENTIFIER_NODE || (nodeKind === ASTNodeKind.SIGNATURE_NODE && !signatures)) {
		return selectionRange;
	}
	if (nodeKind === ASTNodeKind.SIGNATURE_NODE && signatures) {
		const signature = signatures.get(node as SignatureNode);
		if (!signature?.doesOverloadBuiltin(signatures)) return selectionRange;
	}

	return null;
}
