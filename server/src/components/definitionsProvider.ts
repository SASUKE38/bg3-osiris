import { Connection, DefinitionParams, Location, ServerCapabilities } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { ASTNodeKind, IdentifierNode, RuleNode, SignatureNode } from "../parser/ast/nodes";
import { isOutParameter } from "../utils/signatureUtils";

/**
 * Server component that handles Definition and Implementation requests.
 */
export class DefinitionsProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onDefinition(this.handleDefinition);
		connection.onImplementation(this.handleDefinition);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			definitionProvider: true,
			implementationProvider: true
		};
	}

	/**
	 * The handler for the Definition and Implementation requests.
	 *
	 * @param params The {@link DefinitionParams} for this request.
	 * @returns An {@link Array} of {@link Location} instances that contain the definitions found for the request.
	 */
	private handleDefinition = async (params: DefinitionParams): Promise<Location[] | null> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		if (!resource) return null;

		const signatures = await this.server.modManager.getAllDefinedSignatures();
		const nodesAt = await resource.getNodesAt(params.position);
		const searchNode = nodesAt[nodesAt.length - 1];
		if (!searchNode) return null;

		if (searchNode.kind === ASTNodeKind.IDENTIFIER_NODE) {
			if ((searchNode as IdentifierNode).value === "_" || !(searchNode as IdentifierNode).value.startsWith("_"))
				return null;
			for (const node of nodesAt) {
				if (node.kind !== ASTNodeKind.RULE_NODE) continue;

				const signatureNodes = [
					(node as RuleNode).call,
					...((node as RuleNode).conditions.filter(
						(value) => value.kind === ASTNodeKind.SIGNATURE_NODE
					) as SignatureNode[])
				];
				for (let i = 0; i < signatureNodes.length; i++) {
					const signature = signatures.get(signatureNodes[i]);
					const ruleType = (node as RuleNode).type;
					if (!signature) continue;
					for (let j = 0; j < signatureNodes[i].parameters.length; j++) {
						const parameter = signatureNodes[i].parameters[j];
						if (
							parameter.content.kind !== ASTNodeKind.IDENTIFIER_NODE ||
							(parameter.content as IdentifierNode).value !== (searchNode as IdentifierNode).value
						)
							continue;
						const isOut = isOutParameter(signature, j);
						const isDeletion = signatureNodes[i].isDeletion;

						if (
							(isOut && !isDeletion) ||
							signature.type === "Database" ||
							signature.type === "Event" ||
							(i === 0 && ruleType === "PROC" && signature.type === "Proc") ||
							(i === 0 && ruleType === "QRY" && signature.type === "UserQuery")
						) {
							return [Location.create(resource.getTextDocument().uri, parameter.selectionRange)];
						}
					}
				}
			}
		} else if (searchNode.kind === ASTNodeKind.SIGNATURE_NODE) {
			const signature = signatures.get(searchNode as SignatureNode);
			if (signature?.type !== "Proc" && signature?.type !== "UserQuery") return null;
			return signature.definitions ? signature.definitions : null;
		}

		return null;
	};
}
