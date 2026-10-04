/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	CompletionItem,
	CompletionItemKind,
	CompletionParams,
	Connection,
	Position,
	Range,
	ServerCapabilities
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	IdentifierNode,
	RuleNode,
	SignatureNode,
	TypeEnumMemberNode
} from "../parser/ast/nodes";
import { SignatureCollection } from "../mods/signature";
import { TextDocument } from "vscode-languageserver-textdocument";
import { rangeContainsPosition } from "../utils/positionUtils";

export class CompletionProvider extends ComponentBase {
	async initializeComponent(connection: Connection): Promise<void> {
		connection.onCompletion(this.handleCompletion);
		connection.onCompletionResolve(this.handleCompletionResolve);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return { completionProvider: { resolveProvider: true, triggerCharacters: ['"', "."] } };
	}

	/*
	TODO: Fix parsing for last node of kb section
	TODO: Fix / showing up
	TODO: Make .  and " trigger completion only in parameters

	*For INIT and EXIT: Add DBs, PROCs, and calls
	*FOR KB: Add PROC, QRY, IF
	*For PROC call: Add PROC_
	*For QRY call: Add QRY_
	*For IF call: Add DB_ and builtin events and queries
	*For conditions: Add QRY_, DB_, builtin queries, constants, and (if in KB) variables
	*For actions: Add PROC_, DB_, and builtin calls
	*For signatures and comparisons: Add types, constants, and (if in KB) variables
	*For strings: Add strings
	For type enums: Add enum members
	*/

	private handleCompletion = async (params: CompletionParams): Promise<CompletionItem[]> => {
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		const nodesAt = await resource?.getNodesAt(params.position);
		if (!resource || !nodesAt || nodesAt.length === 0) return [];
		const signatures = await this.server.modManager.getAllDefinedSignatures();
		const requestOffset = resource.getTextDocument().offsetAt(params.position);

		for (let i = nodesAt.length - 1; i >= 0; i--) {
			const node = nodesAt[i];
			if (node.kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
				return await this.getSignatureSectionCompletions(signatures);
			} else if (node.kind === ASTNodeKind.KB_SECTION_NODE) {
				return await this.getKBSectionCompletions(signatures);
			} else if (node.kind === ASTNodeKind.RULE_NODE) {
				return await this.getRuleCompletions(
					node as RuleNode,
					resource.getTextDocument(),
					signatures,
					requestOffset,
					nodesAt
				);
			} else if (node.kind === ASTNodeKind.STRING_NODE) {
				return this.getStringCompletions();
			} else if (
				node.kind === ASTNodeKind.SIGNATURE_NODE &&
				requestOffset > resource.getTextDocument().offsetAt((node as SignatureNode).selectionRange.end)
			) {
				return this.getSignatureCompletions(
					node as SignatureNode,
					resource.getTextDocument(),
					params.position,
					nodesAt
				);
			} else if (node.kind === ASTNodeKind.COMPARISON_NODE) {
				return await this.getParameterCompletions(
					node as ComparisonNode,
					resource.getTextDocument(),
					params.position,
					nodesAt
				);
			}
		}

		return [];
	};

	private handleCompletionResolve = async (item: CompletionItem): Promise<CompletionItem> => {
		return item;
	};

	private toCompletionItems(values: string[], kind: CompletionItemKind): CompletionItem[] {
		return values.map((value) => {
			return {
				label: value,
				kind
			};
		});
	}

	private async getSignatureSectionCompletions(signatures: SignatureCollection): Promise<CompletionItem[]> {
		return this.toCompletionItems(
			[...signatures.getAllNamesOfType("Database", "Call", "Proc", "SysCall")],
			CompletionItemKind.Function
		);
	}

	private async getKBSectionCompletions(signatures: SignatureCollection): Promise<CompletionItem[]> {
		return this.toCompletionItems(
			[...signatures.getAllNamesOfType("Database", "Call", "Proc", "SysCall")],
			CompletionItemKind.Function
		);
	}

	private async getStringCompletions(): Promise<CompletionItem[]> {
		return this.toCompletionItems(
			Array.from(await this.server.modManager.getAllStrings()),
			CompletionItemKind.Value
		);
	}

	private async getRuleCompletions(
		node: RuleNode,
		document: TextDocument,
		signatures: SignatureCollection,
		requestOffset: number,
		nodesAt: ASTNode[]
	): Promise<CompletionItem[]> {
		const actionStart = node.actions.length > 0 ? document.offsetAt(node.actions[0].range.start) : undefined;
		// Before/in call: provide call completions
		if (requestOffset <= document.offsetAt(node.call.range.end)) {
			switch (node.type) {
				case "PROC":
					return this.toCompletionItems(
						[...signatures.getAllNamesOfType("Proc")],
						CompletionItemKind.Function
					);
					break;
				case "QRY":
					return this.toCompletionItems(
						[...signatures.getAllNamesOfType("UserQuery")],
						CompletionItemKind.Function
					);
					break;
				case "IF":
					return this.toCompletionItems(
						[...signatures.getAllNamesOfType("Database", "Event")],
						CompletionItemKind.Function
					);
					break;
				default:
					return [];
					break;
			}
			// - In action block: provide action completions. No actions will default to kb completions, so those should include action completions
		} else if (actionStart && requestOffset >= actionStart) {
			return this.toCompletionItems(
				[...signatures.getAllNamesOfType("Database", "Call", "Proc", "SysCall")],
				CompletionItemKind.Function
			);
			// - Beyond call: provide condition completions
		} else {
			return [
				...this.toCompletionItems(
					[...signatures.getAllNamesOfType("Database", "Query", "UserQuery", "SysQuery")],
					CompletionItemKind.Function
				),
				...(await this.getVariableCompletions(nodesAt)),
				...this.getEnumTypeNameCompletions()
			];
		}
	}

	private async getVariables(nodesAt: ASTNode[]): Promise<string[]> {
		const res = new Set<string>();

		for (const node of nodesAt) {
			if (node.kind !== ASTNodeKind.RULE_NODE) continue;
			const signatures = [
				(node as RuleNode).call,
				...(node as RuleNode).conditions,
				...(node as RuleNode).actions
			];
			for (const signature of signatures) {
				if (signature.kind !== ASTNodeKind.SIGNATURE_NODE) continue;
				(signature as SignatureNode).parameters.forEach((value) => {
					if (
						value.content.kind === ASTNodeKind.IDENTIFIER_NODE &&
						(value.content as IdentifierNode).value.startsWith("_") &&
						(value.content as IdentifierNode).value !== "_"
					)
						res.add((value.content as IdentifierNode).value);
				});
			}
		}

		return Array.from(res);
	}

	private async getVariableCompletions(nodesAt: ASTNode[]): Promise<CompletionItem[]> {
		return this.toCompletionItems(await this.getVariables(nodesAt), CompletionItemKind.Variable);
	}

	// TODO: Make constants be registered by just the GUID portion, not the full name

	private async getConstantCompletions(): Promise<CompletionItem[]> {
		return this.toCompletionItems(
			Array.from(await this.server.modManager.getAllConstants()),
			CompletionItemKind.Constant
		);
	}

	private getTypeCompletions(): CompletionItem[] {
		if (!this.server.modManager.mod) return [];
		return this.toCompletionItems(
			Array.from(this.server.modManager.mod?.inheritedTypes.keys()),
			CompletionItemKind.TypeParameter
		);
	}

	private getEnumTypeNameCompletions(): CompletionItem[] {
		const { mod } = this.server.modManager;
		if (!mod) return [];
		return this.toCompletionItems(Array.from(mod.inheritedEnums.keys()), CompletionItemKind.Enum);
	}

	private getEnumMemberCompletions(node: SignatureNode | ComparisonNode, position: Position): CompletionItem[] {
		const { mod } = this.server.modManager;
		if (!mod) return [];
		if (node.kind === ASTNodeKind.SIGNATURE_NODE) {
			for (const parameterNode of (node as SignatureNode).parameters) {
				if (rangeContainsPosition(parameterNode.range, position)) {
					if (parameterNode.content.kind !== ASTNodeKind.TYPE_ENUM_MEMBER_NODE) return [];
					const enumValues = mod.inheritedEnums.get((parameterNode.content as TypeEnumMemberNode).type);
					if (!enumValues) return [];
					return this.toCompletionItems(enumValues.members, CompletionItemKind.EnumMember);
				}
			}
		} else {
			let operandNode: ASTNode | undefined;
			if (
				(node as ComparisonNode).left.kind === ASTNodeKind.TYPE_ENUM_MEMBER_NODE &&
				rangeContainsPosition((node as ComparisonNode).left.range, position)
			) {
				operandNode = (node as ComparisonNode).left;
			} else if (
				(node as ComparisonNode).right.kind === ASTNodeKind.TYPE_ENUM_MEMBER_NODE &&
				rangeContainsPosition((node as ComparisonNode).right.range, position)
			) {
				operandNode = (node as ComparisonNode).right;
			}
			if (!operandNode) return [];
			const enumValues = mod.inheritedEnums.get((operandNode as TypeEnumMemberNode).type);
			if (!enumValues) return [];
			return this.toCompletionItems(enumValues.members, CompletionItemKind.EnumMember);
		}
		return [];
	}

	private async getParameterCompletions(
		node: SignatureNode | ComparisonNode,
		document: TextDocument,
		position: Position,
		nodesAt: ASTNode[]
	): Promise<CompletionItem[]> {
		const text = document.getText(
			Range.create(document.positionAt(document.offsetAt(node.selectionRange.end) + 1), position)
		);
		if (/[A-Z]+\.[a-zA-Z]*$/.test(text)) {
			return this.getEnumMemberCompletions(node, position);
		} else {
			return [
				...(await this.getConstantCompletions()),
				...(await this.getVariableCompletions(nodesAt)),
				...this.getEnumTypeNameCompletions()
			];
		}
	}

	private async getSignatureCompletions(
		node: SignatureNode,
		document: TextDocument,
		position: Position,
		nodesAt: ASTNode[]
	): Promise<CompletionItem[]> {
		const text = document.getText(
			Range.create(document.positionAt(document.offsetAt(node.selectionRange.end) + 1), position)
		);
		if (/\([^\)]*$/.test(text)) {
			return this.getTypeCompletions();
		} else {
			return await this.getParameterCompletions(node, document, position, nodesAt);
		}
	}
}
