import {
	Connection,
	DocumentSymbol,
	DocumentSymbolParams,
	SemanticTokens,
	SemanticTokensBuilder,
	SemanticTokensParams,
	ServerCapabilities,
	WorkspaceSymbol
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { ASTNode, ASTNodeKind, SignatureNode, TypeEnumMemberNode } from "../parser/ast/nodes";
import { SignatureCollection } from "../mods/signature";

export const SemanticTokenOsirisTypes = ["call", "event", "query", "function", "enum", "enumMember"];

/**
 * Server component that manages document symbols.
 */
export class SymbolManager extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onDocumentSymbol(this.handleDocumentSymbol);
		connection.onWorkspaceSymbol(this.handleWorkspaceSymbol);
		connection.languages.semanticTokens.on(this.handleSemanticTokens);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			documentSymbolProvider: true,
			workspaceSymbolProvider: true,
			semanticTokensProvider: {
				legend: {
					tokenTypes: SemanticTokenOsirisTypes,
					tokenModifiers: []
				},
				full: {
					delta: false
				}
			}
		};
	}

	/**
	 * The handler for the Document Symbol request.
	 *
	 * @param params The {@link DocumentSymbolParams} for this request.
	 * @returns An {@link Array} of {@link DocumentSymbol} instances in this mod.
	 */
	private handleDocumentSymbol = async (params: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		if (!resource) return Promise.resolve([]);
		return await resource.getData("symbols");
	};

	/**
	 * The handler for the Workspace Symbol request.
	 *
	 * @returns An {@link Array} of {@link WorkspaceSymbol} instances in this mod.
	 */
	private handleWorkspaceSymbol = async (): Promise<WorkspaceSymbol[]> => {
		let res: WorkspaceSymbol[] = [];
		for (const resource of this.server.modManager.getAllResources()) {
			res = [...res, ...(await resource.getData("workspaceSymbols"))];
		}
		return res;
	};

	/**
	 * The handler for the Semantic Tokens request.
	 *
	 * @param params The {@link SemanticTokensParams} for this request.
	 * @returns A {@link SemanticTokens} instance of the Semantic Tokens for a given document.
	 */
	private handleSemanticTokens = async (params: SemanticTokensParams): Promise<SemanticTokens> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		const root = await resource?.getRootNode();
		if (!root) return { data: [] };
		const signatures = await this.server.modManager.getAllDefinedSignatures();
		const builder = new SemanticTokensBuilder();

		function getTokens(node: ASTNode, thisArg: SymbolManager) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.SIGNATURE_NODE || child.kind === ASTNodeKind.TYPE_ENUM_MEMBER_NODE) {
					if (child.kind === ASTNodeKind.SIGNATURE_NODE) {
						thisArg.tryGetSemanticSignature(child as SignatureNode, signatures, builder);
					} else if (child.kind === ASTNodeKind.TYPE_ENUM_MEMBER_NODE) {
						const enumNode = child as TypeEnumMemberNode;
						builder.push(
							enumNode.range.start.line,
							enumNode.range.start.character,
							enumNode.type.length,
							SemanticTokenOsirisTypes.indexOf("enum"),
							0
						);
						builder.push(
							enumNode.range.start.line,
							enumNode.range.start.character + enumNode.type.length + 1,
							enumNode.member.length,
							SemanticTokenOsirisTypes.indexOf("enumMember"),
							0
						);
					}
				}
				getTokens(child, thisArg);
			}
		}

		getTokens(root, this);
		return builder.build();
	};

	/**
	 * Gets the semantic highlighting for a signature if it is a built-in.
	 *
	 * @param signatureNode The node containing the signature to try to get the semantic type of.
	 * @param signatures The signature collection of the mod's inherited and custom signatures.
	 * @param builder The builder containing the semantic token result.
	 */
	private tryGetSemanticSignature(
		signatureNode: SignatureNode,
		signatures: SignatureCollection,
		builder: SemanticTokensBuilder
	) {
		const signature = signatures.get(signatureNode);
		if (!signature) return;
		const length = signatureNode.selectionRange.end.character - signatureNode.selectionRange.start.character;
		let searchType;
		switch (signatures.getHierarchicalType(signature)) {
			case "Event":
				searchType = "event";
				break;
			case "Query":
				searchType = "query";
				break;
			case "SysCall":
				searchType = "call";
				break;
			case "SysQuery":
				searchType = "query";
				break;
			case "Call":
				searchType = "call";
				break;
			default:
				return;
				break;
		}
		const type = SemanticTokenOsirisTypes.indexOf(searchType);
		builder.push(signatureNode.range.start.line, signatureNode.range.start.character, length, type, 0);
	}

	/**
	 * Returns all of the symbols in this mod.
	 *
	 * @returns A {@link Map} with URI keys and {@link Array} of {@link DocumentSymbol} instance values
	 * that represent the Document Symbols for each document URI.
	 */
	async getAllSymbols(): Promise<Map<string, DocumentSymbol[]>> {
		const resources = this.server.modManager.getAllResources();
		const res = new Map<string, DocumentSymbol[]>();

		for (const resource of resources) {
			res.set(resource.path, await resource.getData("symbols"));
		}

		return res;
	}
}
