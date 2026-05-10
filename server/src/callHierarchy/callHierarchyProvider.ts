import {
	CallHierarchyIncomingCall,
	CallHierarchyIncomingCallsParams,
	CallHierarchyItem,
	CallHierarchyOutgoingCall,
	CallHierarchyOutgoingCallsParams,
	CallHierarchyPrepareParams,
	Connection,
	ServerCapabilities,
	SymbolKind
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from '../utils/path/pathUtils';
import { ASTNodeKind, SignatureNode } from '../parser/ast/nodes';

export class CallHierarchyProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.languages.callHierarchy.onPrepare(this.handlePrepare);
		connection.languages.callHierarchy.onIncomingCalls(this.handleIncomingCalls);
		connection.languages.callHierarchy.onOutgoingCalls(this.handleOutgoingCalls);
	}
	
	getCapabilities(): Partial<ServerCapabilities> {
		return {
			callHierarchyProvider: true
		};
	}

	private handlePrepare = async (params: CallHierarchyPrepareParams): Promise<CallHierarchyItem[] | null> => {
		const { modManager } = this.server;
		const resoure = modManager.findResource(decodePath(params.textDocument.uri));
		const nodesAt = await resoure?.getNodesAt(params.position);
		const signature = nodesAt?.find((value) => value.kind === ASTNodeKind.SIGNATURE_NODE) as SignatureNode | undefined;
		if (signature) {
			return [{
				name: signature.name,
				kind: SymbolKind.Function,
				uri: params.textDocument.uri,
				range: signature.range,
				selectionRange: signature.selectionRange
			}]
		}
		return null;
	};

	private handleIncomingCalls = async (
		params: CallHierarchyIncomingCallsParams
	): Promise<CallHierarchyIncomingCall[] | null> => {
		return null;
	};

	private handleOutgoingCalls = async (
		params: CallHierarchyOutgoingCallsParams
	): Promise<CallHierarchyOutgoingCall[] | null> => {
		return null;
	};
}
