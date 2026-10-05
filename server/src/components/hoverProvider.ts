import { Connection, Hover, HoverParams, MarkupKind, ServerCapabilities } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { rangeContainsPosition } from "../utils/positionUtils";
import { ASTNode, ASTNodeKind, IdentifierNode, ParameterNode, RuleNode, SignatureNode } from "../parser/ast/nodes";
import { getReadableSignatureType, Signature, SignatureCollection } from "../mods/signature";
import { getParameterBinding, isOutParameter } from "../utils/signatureUtils";

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
		const signatures = await modManager.getAllDefinedSignatures();
		const signature = signatures.get(signatureNode);
		if (!signature) return null;

		switch (hoveredNode.kind) {
			case ASTNodeKind.SIGNATURE_NODE:
				return this.handleSignatureHover(signature);
				break;
			case ASTNodeKind.IDENTIFIER_NODE: {
				if ((hoveredNode as IdentifierNode).value === "_") return null;
				let i = 0;
				while (
					i < signatureNode.parameters.length &&
					!rangeContainsPosition(signatureNode.parameters[i].selectionRange, params.position)
				)
					i++;
				const parameterNode = signatureNode.parameters[i];
				if ((hoveredNode as IdentifierNode).value.startsWith("_")) {
					return this.handleVariableHover(parameterNode, nodesAt, signatures, hoveredNode as IdentifierNode);
				} else {
					return this.handleConstantHover(i, parameterNode, signature, hoveredNode as IdentifierNode);
				}
				break;
			}
			default:
				break;
		}
		return null;
	};

	private async handleSignatureHover(signature: Signature): Promise<Hover> {
		if (
			signature.type === "Call" ||
			signature.type === "Event" ||
			signature.type === "Query" ||
			signature.type === "SysCall" ||
			signature.type === "SysQuery"
		) {
			const documentation = (await this.server.documentationManager.getSignatureDocumentation(signature)).join(
				"\n"
			);
			if (documentation !== "")
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: documentation
					}
				};
		}
		const content: string[] = [getReadableSignatureType(signature.type), " ", signature.name, "("];

		for (let i = 0; i < signature.parameters.length; i++) {
			if (isOutParameter(signature, i)) content.push("[out]");
			content.push(`(${signature.parameters[i]})_`);
			if (i !== signature.parameters.length - 1) content.push(", ");
		}

		content.push(")");
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: ["```osiris\n", ...content, "\n```"].join("")
			}
		};
	}

	private async handleVariableHover(
		parameterNode: ParameterNode,
		nodesAt: ASTNode[],
		signatures: SignatureCollection,
		hoveredNode: IdentifierNode
	): Promise<Hover | null> {
		let type: string | undefined;
		if (parameterNode.type) {
			type = parameterNode.type.value;
		}

		let ruleNode: RuleNode | undefined;
		for (const node of nodesAt) {
			if (node.kind === ASTNodeKind.RULE_NODE) ruleNode = node as RuleNode;
		}
		if (!ruleNode) return null;
		const bindingData = getParameterBinding(ruleNode, hoveredNode, signatures);
		if (bindingData) type = bindingData.signature.parameters[bindingData.bindingIndex];

		if (!type) type = "UNKNOWN";
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: ["```osiris", `(${type}) ${(hoveredNode as IdentifierNode).value}`, "```"].join("\n")
			}
		};
	}

	private handleConstantHover(
		parameterIndex: number,
		parameterNode: ParameterNode,
		signature: Signature,
		hoveredNode: IdentifierNode
	): Hover {
		let type: string | undefined = undefined;
		if (parameterNode.type) type = `(${parameterNode.type.value})`;
		else if (signature.parameters[parameterIndex]) type = `(${signature.parameters[parameterIndex]})`;
		else type = "(GUIDSTRING)";
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: ["```osiris", `${type} ${hoveredNode.value}`, "```"].join("\n")
			}
		};
	}
}
