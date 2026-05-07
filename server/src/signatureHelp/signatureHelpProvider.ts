import {
	Connection,
	ParameterInformation,
	Position,
	SignatureHelp,
	SignatureHelpParams,
	SignatureInformation
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";
import { ASTNodeKind, SignatureNode } from "../parser/ast/nodes";
import { DocumentationEntry } from "../documentation/documentationManager";
import { GoalResource } from "../mods/resource/goalResource";

export class SignatureHelpProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onSignatureHelp(this.handleSignatureHelp);
	}

	private handleSignatureHelp = async (params: SignatureHelpParams): Promise<SignatureHelp | null> => {
		const { documentationManager } = this.server;
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		const nodesAt = await resource?.getNodesAt(params.position);
		const signature = nodesAt?.find((node) => node.kind === ASTNodeKind.SIGNATURE_NODE);
		const entry = await documentationManager.getDocumentationEntryForSignature((signature as SignatureNode)?.name);
		if (entry && resource) {
			const signatures = documentationManager.getAllSignatureLabels(entry);
			const activeSignature = signatures.findIndex(
				(value) => value.split(",").length === (signature as SignatureNode).parameters.length
			);
			return {
				signatures: this.getSignatureInformation(signature as SignatureNode, signatures, entry),
				activeSignature: activeSignature > 0 ? activeSignature : 0,
				activeParameter: this.getActiveParameter(resource, params.position, signature as SignatureNode)
			};
		}
		return null;
	};

	private getSignatureInformation(
		signature: SignatureNode,
		signatures: string[],
		entry: DocumentationEntry
	): SignatureInformation[] {
		return signatures.map((value) => {
			return {
				label: value,
				documentation: {
					kind: "markdown",
					value: this.server.documentationManager.getSignatureDocumentationBody(entry).join("\n")
				},
				parameters: this.getParameterInformation((signature as SignatureNode).name, value, entry)
			};
		});
	}

	private getParameterInformation(
		name: string,
		definition: string,
		entry: DocumentationEntry
	): ParameterInformation[] {
		return definition.split(",").map((value, i) => {
			return { label: i === 0 ? value.substring(entry.type.length + name.length + 2) : value };
		});
	}

	private getActiveParameter(resource: GoalResource, position: Position, signature: SignatureNode) {
		let res = 0;
		const textDocument = resource.getTextDocument();
		if (textDocument) {
			const cursorOffset = textDocument.offsetAt(position);
			for (const child of signature.getNodeChildren()) {
				if (!child) break;
				const childOffset = textDocument.offsetAt(child.range.end);
				if (cursorOffset > childOffset) res += 1;
				else break;
			}
		}

		return res;
	}
}
