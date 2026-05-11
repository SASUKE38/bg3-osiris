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
import { decodePath, encodePath } from "../utils/path/pathUtils";
import { ASTNodeKind, SignatureNode } from "../parser/ast/nodes";

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
		const resoure = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		const nodesAt = await resoure?.getNodesAt(params.position);
		const signature = nodesAt?.find((value) => value.kind === ASTNodeKind.SIGNATURE_NODE) as
			| SignatureNode
			| undefined;
		if (signature) {
			return [
				{
					name: signature.name,
					kind: SymbolKind.Function,
					uri: params.textDocument.uri,
					range: signature.range,
					selectionRange: signature.selectionRange
				}
			];
		}
		return null;
	};

	// callers of
	private handleIncomingCalls = async (
		params: CallHierarchyIncomingCallsParams
	): Promise<CallHierarchyIncomingCall[]> => {
		const allSymbols = await this.server.symbolManager.getAllSymbols();
		const res: CallHierarchyIncomingCall[] = [];

		for (const entry of allSymbols) {
			const encodedPath = encodePath(entry[0]);
			if (entry[1][1].children) {
				for (const rule of entry[1][1].children) {
					if (rule.children) {
						for (let i = 1; i < rule.children?.length; i++) {
							if (rule.children[i].name === params.item.name) {
								res.push({
									from: {
										name: rule.children[0].name,
										kind: SymbolKind.Function,
										uri: encodedPath,
										range: rule.children[0].range,
										selectionRange: rule.children[0].selectionRange
									},
									fromRanges: [rule.children[0].selectionRange]
								});
							}
						}
					}
				}
			}
		}

		return res;
	};

	// calls from
	private handleOutgoingCalls = async (
		params: CallHierarchyOutgoingCallsParams
	): Promise<CallHierarchyOutgoingCall[]> => {
		const allSymbols = await this.server.symbolManager.getAllSymbols();
		const res: CallHierarchyOutgoingCall[] = [];

		for (const entry of allSymbols) {
			const encodedPath = encodePath(entry[0]);
			if (entry[1][1].children) {
				for (const rule of entry[1][1].children) {
					if (rule.children) {
						if (rule.children[0].name === params.item.name) {
							for (let i = 1; i < rule.children.length; i++) {
								res.push({
									to: {
										name: rule.children[i].name,
										kind: SymbolKind.Function,
										uri: encodedPath,
										range: rule.children[i].range,
										selectionRange: rule.children[i].selectionRange
									},
									fromRanges: [rule.children[i].selectionRange]
								});
							}
						}
					}
				}
			}
		}

		return res;
	};
}
