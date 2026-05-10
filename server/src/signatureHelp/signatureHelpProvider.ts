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

export class SignatureHelpProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onSignatureHelp(this.handleSignatureHelp);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			signatureHelpProvider: { triggerCharacters: ["(", ","] }
		};
	}

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
