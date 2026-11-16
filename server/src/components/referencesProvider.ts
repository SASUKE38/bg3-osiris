import {
	Connection,
	DocumentHighlight,
	DocumentHighlightParams,
	Location,
	ReferenceParams,
	ServerCapabilities
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath, encodePath } from "../utils/pathUtils";
import { Resource } from "../mods/resource/resource";
import { findNestedUses, findVariableUses, validateRenameOrReferences } from "../utils/signatureUtils";
import { ASTNode, ASTNodeKind, IdentifierNode, SignatureNode } from "../parser/ast/nodes";

/**
 * Server component that handles References and Document Highlight requests.
 */
export class ReferencesProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onReferences(this.handleReferences);
		connection.onDocumentHighlight(this.handleDocumentHighlight);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			referencesProvider: true,
			documentHighlightProvider: true
		};
	}

	/**
	 * The handler for the References request.
	 *
	 * @param params The {@link ReferenceParams} for the request.
	 * @returns An {@link Array} of {@link Location} instances if references can be found for the given parameters,
	 * null otherwise.
	 */
	private handleReferences = async (params: ReferenceParams): Promise<Location[] | null> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		if (!resource || !await validateRenameOrReferences(params, resource)) return null;

		const nodesAt = await resource.getNodesAt(params.position);
		const searchNode = nodesAt[nodesAt.length - 1];
		if (!searchNode) return null;

		if (searchNode.kind === ASTNodeKind.IDENTIFIER_NODE && (searchNode as IdentifierNode).value.startsWith("_")) {
			return this.findVariableReferences(params.textDocument.uri, nodesAt, searchNode as IdentifierNode);
		} else if (searchNode.kind === ASTNodeKind.IDENTIFIER_NODE) {
			return await this.findConstantReferences(searchNode as IdentifierNode);
		} else if (searchNode.kind === ASTNodeKind.SIGNATURE_NODE) {
			return await this.findSignatureReferences(searchNode as SignatureNode);
		}

		return null;
	};

	/**
	 * The handler for the Document Highlight request.
	 *
	 * @param params The {@link DocumentHighlightParams} for this request.
	 * @returns An {@link Array} of {@link DocumentHighlight} instances if document highlights can be calculated
	 * for this request, null otherwise.
	 */
	private handleDocumentHighlight = async (params: DocumentHighlightParams): Promise<DocumentHighlight[] | null> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		if (!resource || !await validateRenameOrReferences(params, resource)) return null;

		const nodesAt = await resource.getNodesAt(params.position);
		const searchNode = nodesAt[nodesAt.length - 1];

		if (searchNode.kind === ASTNodeKind.IDENTIFIER_NODE && (searchNode as IdentifierNode).value.startsWith("_")) {
			return this.findVariableHighlights(nodesAt, searchNode as IdentifierNode);
		} else if (searchNode.kind === ASTNodeKind.SIGNATURE_NODE || searchNode.kind === ASTNodeKind.IDENTIFIER_NODE) {
			return await this.findSignatureOrConstantHighlights(resource, searchNode as SignatureNode | IdentifierNode);
		}

		return null;
	};

	/**
	 * Finds all variable references in a given collection of nodes.
	 *
	 * @param document The uri of the document to search in.
	 * @param nodesAt The nodes to search in.
	 * @param searchNode The node to search for.
	 * @returns An {@link Array} of {@link Location} instances where the search node is found.
	 */
	private findVariableReferences(
		document: string,
		nodesAt: ASTNode[],
		searchNode: IdentifierNode
	): Location[] {
		const res: Location[] = [];

		for (const range of findVariableUses(nodesAt, searchNode)) {
			res.push(Location.create(document, range));
		}

		return res;
	}

	/**
	 * Finds all ranges to highlight for a given variable.
	 *
	 * @param nodesAt The nodes to search in.
	 * @param searchNode The node to search for.
	 * @returns An {@link Array} of {@link Range} instances where the search node is found.
	 */
	private findVariableHighlights(nodesAt: ASTNode[], searchNode: IdentifierNode): DocumentHighlight[] {
		const res: DocumentHighlight[] = [];

		for (const range of findVariableUses(nodesAt, searchNode)) {
			res.push({ range: range });
		}

		return res;
	}

	/**
	 * Finds all function references for a given node in the mod.
	 *
	 * @param searchNode The node to search for.
	 * @returns An {@link Array} of {@link Location} instances where the search node is found.
	 */
	private async findSignatureReferences(searchNode: SignatureNode): Promise<Location[]> {
		const res: Location[] = [];

		for (const resource of this.server.modManager.getAllResources()) {
			const path = encodePath(resource.path)
			const root = await resource.getRootNode();
			if (!root) continue;
			for (const range of findNestedUses(root, searchNode)) {
				res.push({uri: path, range })
			}
		}

		return res;
	}

	/**
	 * Finds all ranges to highlight for a given function or constant.
	 *
	 * @param resource The resource to search in.
	 * @param searchNode The node to search for.
	 * @returns An {@link Array} of {@link DocumentHighlight} instances of where the search node was found.
	 */
	private async findSignatureOrConstantHighlights(resource: Resource, searchNode: SignatureNode | IdentifierNode): Promise<DocumentHighlight[]> {
		const res: DocumentHighlight[] = [];
		const root = await resource.getRootNode();
		if (!root) return res;

		for (const range of findNestedUses(root, searchNode)) {
			res.push({ range })
		}

		return res;
	}

	/**
	 * Finds all instances of a given constant in the mod.
	 * 
	 * @param searchNode The node to search for.
	 * @returns An {@link Array} of {@link Location} instances where the search node is found.
	 */
	private async findConstantReferences(searchNode: IdentifierNode): Promise<Location[]> {
		const res: Location[] = [];

		for (const resource of this.server.modManager.getAllResources()) {
			const path = encodePath(resource.path);
			const constants = await resource.getData("constants");
			for (const constant of constants) {
				if (constant[0] !== searchNode.value) continue;
				constant[1].forEach((value) => res.push({uri: path, range: value}));
			}
		}

		return res;
	}
}
