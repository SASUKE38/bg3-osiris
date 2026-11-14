/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	Connection,
	PrepareRenameParams,
	Range,
	RenameParams,
	ServerCapabilities,
	WorkspaceEdit
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath, encodePath } from "../utils/pathUtils";
import { findNestedUses, findVariableUses, validateRenameOrReferences } from "../utils/signatureUtils";
import { ASTNode, ASTNodeKind, IdentifierNode, SignatureNode } from "../parser/ast/nodes";

/**
 * Server component that handles rename requests.
 */
export class RenameProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onPrepareRename(this.handlePrepareRename);
		connection.onRenameRequest(this.handleRenameRequest);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			renameProvider: {
				prepareProvider: true
			}
		};
	}

	/**
	 * The handler for the Prepare Rename request.
	 *
	 * @param params The {@link PrepareRenameParams} for this request.
	 * @returns A {@link Range} instance if this is a valid request, null otherwise.
	 */
	private handlePrepareRename = async (params: PrepareRenameParams): Promise<Range | null> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		if (!resource) return null;
		return await validateRenameOrReferences(
			params,
			resource,
			await this.server.modManager.getAllDefinedSignatures()
		);
	};

	/**
	 * The handler for the Rename request.
	 *
	 * @param params The {@link RenameParams} for this request.
	 * @returns A {@link WorkspaceEdit} if this request is valid, null otherwise.
	 */
	private handleRenameRequest = async (params: RenameParams): Promise<WorkspaceEdit | null> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		if (!resource) return null;

		const nodesAt = await resource.getNodesAt(params.position);
		const oldNode = nodesAt[nodesAt.length - 1];

		if (oldNode.kind === ASTNodeKind.IDENTIFIER_NODE && (oldNode as IdentifierNode).value.startsWith("_")) {
			return this.renameVariable(params, nodesAt, oldNode as IdentifierNode);
		} else if (oldNode.kind === ASTNodeKind.IDENTIFIER_NODE) {
			return await this.renameConstant(params, oldNode as IdentifierNode);
		} else if (oldNode.kind === ASTNodeKind.SIGNATURE_NODE) {
			return await this.renameSignature(params, oldNode as SignatureNode);
		}
		return null;
	};

	/**
	 * Renames a node in the mod.
	 *
	 * @param params The {@link RenameParams} for this request.
	 * @param oldNode The node to be renamed.
	 * @returns A {@link WorkspaceEdit} containing the result of the rename operation.
	 */
	private async renameSignature(params: RenameParams, oldNode: SignatureNode): Promise<WorkspaceEdit> {
		const res: WorkspaceEdit = { changes: {} };

		for (const resource of this.server.modManager.getAllResources()) {
			res.changes![`${encodePath(resource.path)}`] = [];
			const root = await resource.getRootNode();
			if (!root) continue;
			for (const range of findNestedUses(root, oldNode)) {
				res.changes![`${encodePath(resource.path)}`].push({ range: range, newText: params.newName });
			}
		}

		return res;
	}

	/**
	 * Renames a variable or constant.
	 *
	 * @param params The {@link RenameParams} for this request.
	 * @param nodesAt The nodes at the request's position.
	 * @param oldNode The node to be renamed.
	 * @returns A {@link WorkspaceEdit} containing the result of the rename operation.
	 */
	private renameVariable(params: RenameParams, nodesAt: ASTNode[], oldNode: IdentifierNode): WorkspaceEdit {
		const res: WorkspaceEdit = { changes: { [`${params.textDocument.uri}`]: [] } };

		for (const range of findVariableUses(nodesAt, oldNode)) {
			res.changes![params.textDocument.uri].push({ range: range, newText: params.newName });
		}

		return res;
	}

	/**
	 * Renames a declaration constant.
	 *
	 * @param params The {@link RenameParams} for this request.
	 * @param oldNode The node to be renamed.
	 * @returns A {@link WorkspaceEdit} containing the result of the rename operation.
	 */
	private async renameConstant(params: RenameParams, oldNode: IdentifierNode): Promise<WorkspaceEdit> {
		const res: WorkspaceEdit = { changes: {} };
		for (const resource of this.server.modManager.getAllResources()) {
			const path = encodePath(resource.path);
			res.changes![`${path}`] = [];
			const constants = await resource.getData("constants");
			for (const constant of constants) {
				if (constant[0] !== oldNode.value) continue;
				constant[1].forEach((value) => res.changes![`${path}`].push({ range: value, newText: params.newName }));
			}
		}

		return res;
	}
}
