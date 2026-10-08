import {
	Connection,
	MarkupKind,
	Position,
	ServerCapabilities,
	SignatureHelp,
	SignatureHelpParams,
	SignatureInformation
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { ASTNodeKind, SignatureNode } from "../parser/ast/nodes";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SignatureCollection } from "../mods/signature";

/**
 * Server component that manages Signature Help.
 */
export class SignatureHelpProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onSignatureHelp(this.handleSignatureHelp);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			signatureHelpProvider: { triggerCharacters: ["(", ","] }
		};
	}

	/**
	 * The handler for the Signature Help request.
	 *
	 * @param params The {@link SignatureHelpParams} for this request.
	 * @returns A {@link SignatureHelp} instance if one could be constructed from the given parameters.
	 */
	private handleSignatureHelp = async (params: SignatureHelpParams): Promise<SignatureHelp | null> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		if (!resource) return null;
		const nodesAt = await resource.getNodesAt(params.position);
		const textDocument = resource.getTextDocument();
		const signatureNode = nodesAt.find((node) => node.kind === ASTNodeKind.SIGNATURE_NODE) as
			| SignatureNode
			| undefined;
		const signatures = await this.server.modManager.getAllDefinedSignatures();
		if (!signatureNode || !this.isValidSignatureHelpPosition(textDocument, signatureNode, params.position))
			return null;

		const signatureInformation = await this.getSignatures(signatureNode, signatures);
		const activeParameter = this.getActiveParameter(textDocument, signatureNode, params.position);

		return {
			signatures: signatureInformation,
			activeSignature: this.getActiveSignature(signatureInformation, signatureNode, activeParameter),
			activeParameter
		};
	};

	/**
	 * Determines if the given combination of text document, signature node, and position can construct
	 * a valid {@link SignatureHelp}.
	 *
	 * @param textDocument The document that contains that is the subject of the Signature Help request.
	 * @param signature The node at which the request is made.
	 * @param position The position at which the request is made.
	 * @returns True if this position can be used to construct a {@link SignatureHelp}, false otherwise.
	 */
	private isValidSignatureHelpPosition(
		textDocument: TextDocument,
		signature: SignatureNode,
		position: Position
	): boolean {
		const cursorOffset = textDocument.offsetAt(position);
		const startOffset = textDocument.offsetAt(signature.selectionRange.start);
		const endOffset = textDocument.offsetAt(signature.selectionRange.end);

		return !(cursorOffset > startOffset && cursorOffset <= endOffset);
	}

	/**
	 * Obtains the {@link SignatureInformation} {@link Array} for a given signature.
	 *
	 * @param signatureNode The node at which the request was made.
	 * @param signatures The {@link SignatureCollection} for this mod.
	 * @returns An {@link Array} of {@link SignatureInformation} instances for this signature.
	 */
	private async getSignatures(
		signatureNode: SignatureNode,
		signatures: SignatureCollection
	): Promise<SignatureInformation[]> {
		const allItems = signatures.getAll(signatureNode);
		const documentationEntry = await this.server.documentationManager.getDocumentationEntryForSignature(
			signatureNode.name
		);
		const documentation = this.server.documentationManager
			.getSignatureDocumentationBody(documentationEntry)
			.join("\n");
		return allItems.map((value) => {
			return {
				label: value.toReadableString(false, true),
				documentation: documentation === "" ? undefined : { kind: MarkupKind.Markdown, value: documentation },
				parameters: value.parameters.map((parameter, i) => {
					return {
						label: `(${parameter})_${i + 1}`
					};
				})
			};
		});
	}

	/**
	 * Obtains the index of the active signature based on the active parameter and number of parameters.
	 *
	 * @param signatures The {@link Array} of {@link SignatureInformation} from which to extract the active signature.
	 * @param signature The node at which the request was made.
	 * @param activeParameter The index of the active parameter.
	 * @returns The index of the active signature.
	 */
	private getActiveSignature(
		signatures: SignatureInformation[],
		signature: SignatureNode,
		activeParameter: number
	): number {
		if (signatures[0].parameters?.length && signature.parameters.length < signatures[0].parameters?.length)
			return 0;
		const index = signatures.findIndex((value) => {
			return value.parameters?.length === Math.max(signature.parameters.length, activeParameter + 1);
		});
		return index >= 0 ? index : signatures.length - 1;
	}

	/**
	 * Obtains the index of the active parameter based on the position of the request.
	 *
	 * @param textDocument The document that contains the request.
	 * @param signature The node at which the request was made.
	 * @param position The position at which the request was made.
	 * @returns The index of the active parameter.
	 */
	private getActiveParameter(textDocument: TextDocument, signature: SignatureNode, position: Position): number {
		let res = 0;
		const cursorOffset = textDocument.offsetAt(position);

		for (const child of signature.getNodeChildren()) {
			if (!child) break;
			const childOffset = textDocument.offsetAt(child.range.end);
			if (cursorOffset > childOffset) res += 1;
			else break;
		}

		return res;
	}
}
