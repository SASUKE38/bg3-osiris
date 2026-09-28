import { Connection, Hover, HoverParams, MarkupKind, ServerCapabilities } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { rangeContainsPosition } from "../utils/positionUtils";
import { ASTNodeKind, IdentifierNode, SignatureNode } from "../parser/ast/nodes";

/**
 * Server component that manages hover requests.
 */
export class HoverProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onHover(this.handleHover);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			hoverProvider: true
		};
	}

	/**
	 * The handler for the Hover request.
	 *
	 * @param params The {@link HoverParams} for this request.
	 * @returns A {@link Hover} instance if the request has a valid position and text document, null otherwise.
	 */
	private handleHover = async (params: HoverParams): Promise<Hover | null> => {
		const { modManager } = this.server;
		const resource = modManager.findGoalResource(decodePath(params.textDocument.uri));

		const nodesAt = await resource?.getNodesAt(params.position);
		if (!nodesAt || nodesAt.length == 0) return null;
		const hoveredNode = nodesAt[nodesAt.length - 1];
		if (!rangeContainsPosition(hoveredNode.selectionRange, params.position)) return null;
		let signatureNode: SignatureNode | undefined = undefined;
		for (const node of nodesAt) {
			if (node.kind === ASTNodeKind.SIGNATURE_NODE) {
				signatureNode = node as SignatureNode;
				break;
			}
		}
		if (!signatureNode) return null;
		const signature = (await modManager.getAllDefinedSignatures()).get(signatureNode);
		if (!signature) return null;

		switch (hoveredNode.kind) {
			case ASTNodeKind.SIGNATURE_NODE:
				break;
			case ASTNodeKind.IDENTIFIER_NODE:
				if ((hoveredNode as IdentifierNode).value.startsWith("_")) {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```osiris", `(UNKNOWN) ${(hoveredNode as IdentifierNode).value}`, "```"].join("\n")
						}
					};
				} else {
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: ["```osiris", `(UNKNOWN) ${(hoveredNode as IdentifierNode).value}`, "```"].join("\n")
						}
					};
				}
				break;
			default:
				break;
		}
		return null;
		// Function:
		// Get the associated signature for the function
		// If the signature is a builtin, get the documentation from the documentation manager. If none exists, go to handling for non-builtin signatures
		// Otherwise, format the signature as such: `type Name ((PARAMETERTYPE)_, [out](PARAMETERTYPE)_)`

		// Variable:
		// Get the type of the variable.
		// Display the hover as `type _Name`

		// Getting variable type:
		// Loop over the signatures.
		// Find the first occurence of the variable in a valid binding location.
		// Get the type of the parameter slot of that signature.
		// If a valid type/binding location cannot be found, use UNKNOWN

		// Constant:
		// Display the name of the constant as as `type Name`
		// Determine type by defaulting to GUIDSTRING or using the type in the type cast/parameter slot if there is a valid type there
	};
}
