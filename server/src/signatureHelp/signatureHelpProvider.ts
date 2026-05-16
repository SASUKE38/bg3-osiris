import {
	Connection,
	MarkupKind,
	ParameterInformation,
	Position,
	ServerCapabilities,
	SignatureHelp,
	SignatureHelpParams,
	SignatureInformation
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";
import { ASTNodeKind, SignatureNode } from "../parser/ast/nodes";
import { DocumentationEntry } from "../documentation/documentationManager";
import { TextDocument } from "vscode-languageserver-textdocument";

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
		const { documentationManager, modManager } = this.server;
		const resource = modManager.findResource(decodePath(params.textDocument.uri));
		const nodesAt = await resource?.getNodesAt(params.position);
		const textDocument = resource?.getTextDocument();
		const signature = nodesAt?.find((node) => node.kind === ASTNodeKind.SIGNATURE_NODE) as
			| SignatureNode
			| undefined;

		if (signature && textDocument && this.isValidSignatureHelpPosition(textDocument, signature, params.position)) {
			const entry = await documentationManager.getDocumentationEntryForSignature(signature.name);
			if (entry) {
				const signatures = this.getSignatures(signature, entry);
				const activeParameter = this.getActiveParameter(textDocument, signature, params.position);
				return {
					signatures,
					activeSignature: this.getActiveSignature(signatures, signature, activeParameter),
					activeParameter
				};
			}
		}

		return null;
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
	 * @param signature The node at which the request was made.
	 * @param entry The {@link DocumentationEntry} for this signature.
	 * @returns An {@link Array} of {@link SignatureInformation} instances for this signature.
	 */
	private getSignatures(signature: SignatureNode, entry: DocumentationEntry): SignatureInformation[] {
		const { documentationManager } = this.server;
		return documentationManager
			.getAllSignatureLabels(entry)
			.map((value) => {
				return {
					label: value.trim(),
					documentation: {
						kind: MarkupKind.Markdown,
						value: this.server.documentationManager.getSignatureDocumentationBody(entry).join("\n")
					},
					parameters: this.getParameterInformation(signature.name, value, entry)
				};
			})
			.sort((a, b) => {
				return a.parameters.length === b.parameters.length
					? 0
					: a.parameters.length < b.parameters.length
						? -1
						: 1;
			});
	}

	/**
	 * Returns an {@link Array} of {@link ParameterInformation} instances constructed from the given
	 * signature's documentation.
	 *
	 * @param name The signature's name.
	 * @param definition The full definition of this signature.
	 * @param entry The {@link DocumentationEntry} for this signature.
	 * @returns
	 */
	private getParameterInformation(
		name: string,
		definition: string,
		entry: DocumentationEntry
	): ParameterInformation[] {
		return definition.split(",").map((value, i) => {
			value = value.trim();
			value = value.endsWith(")") ? value.substring(0, value.length - 1) : value;
			return { label: i === 0 ? value.substring(entry.type.length + name.length + 2) : value };
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
