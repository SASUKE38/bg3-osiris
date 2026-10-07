import { SignatureCollection } from "../mods/signature";
import { ASTNodeKind, IdentifierNode, RuleNode, SignatureNode } from "../parser/ast/nodes";

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
