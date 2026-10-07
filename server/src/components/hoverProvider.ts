import { Connection, Hover, HoverParams, MarkupKind, Position, ServerCapabilities } from "vscode-languageserver";
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

		if (hoveredNode.kind === ASTNodeKind.SIGNATURE_NODE) {
			const signature = (await modManager.getAllDefinedSignatures()).get(hoveredNode as SignatureNode);
			if (!signature) return null;
			return this.handleSignatureHover(signature);
		} else if (hoveredNode.kind === ASTNodeKind.IDENTIFIER_NODE) {
			const parameterIndex = nodesAt.findIndex((value) => value.kind === ASTNodeKind.PARAMETER_NODE);
			if ((hoveredNode as IdentifierNode).value.startsWith("_")) {
				return this.handleVariableHover(parameterIndex, nodesAt, hoveredNode as IdentifierNode, await modManager.getAllDefinedSignatures());
			} else {
				return this.handleConstantHover(parameterIndex, nodesAt, hoveredNode as IdentifierNode, params.position, (await modManager.getAllDefinedSignatures()))
			}
		}

		return null;
	}

	private handleVariableHover(parameterIndex: number, nodesAt: ASTNode[], hoveredNode: IdentifierNode, signatures: SignatureCollection): Hover | null {
		const parameterNode = nodesAt[parameterIndex] as ParameterNode;
		const ruleNode = nodesAt.find((value) => value.kind === ASTNodeKind.RULE_NODE);
		if (!ruleNode) return null;
		const bindingData = getParameterBinding(ruleNode as RuleNode, hoveredNode, signatures);
		let type: string | undefined;

		if (parameterIndex === -1) {
			if (!bindingData) return null;
			type = bindingData.signature.parameters[bindingData.bindingIndex]
		} else {
			type = parameterNode.type ? parameterNode.type.value : bindingData?.signature.parameters[bindingData.bindingIndex];
		}
		
		if (!type) type = "UNKNOWN";
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: ["```osiris", `(${type}) ${(hoveredNode as IdentifierNode).value}`, "```"].join("\n")
			}
		};
	}

	private handleConstantHover(parameterIndex: number, nodesAt: ASTNode[], hoveredNode: IdentifierNode, position: Position, signatures: SignatureCollection): Hover | null {
		let type: string | undefined = undefined;
		
		if (parameterIndex === -1) {
		} else {
			const parameterNode = nodesAt[parameterIndex] as ParameterNode;
			const signatureNode = nodesAt.find((value) => value.kind === ASTNodeKind.SIGNATURE_NODE) as SignatureNode | undefined
			const signature = signatures.get(signatureNode as SignatureNode);
			if (!signature || !signatureNode) return null;
	
			let i = 0;
			while (
				i < signatureNode.parameters.length &&
				!rangeContainsPosition(signatureNode.parameters[i].selectionRange, position)
			)
				i++;

			if (parameterNode.type) type = `(${parameterNode.type.value})`;
			else if (signature.parameters[i]) type = `(${signature.parameters[i]})`;
			else type = "(GUIDSTRING)";
			return {
				contents: {
					kind: MarkupKind.Markdown,
					value: ["```osiris", `${type} ${hoveredNode.value}`, "```"].join("\n")
				}
			};
		}
		return null;
	}

	private async handleSignatureHover(signature: Signature): Promise<Hover> {
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
}
