import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	RuleNode,
	SignatureNode,
	SignatureSectionNode
} from "../../../parser/ast/nodes";
import {
	DbNamingStyleDiagnosticFactory,
	invalidDeletionFromNonDatabaseDiagnosticFactory,
	invalidFunctionTypeInConditionDiagnosticFactory,
	invalidProcDefinitionDiagnosticFactory,
	InvalidSignatureInSectionParams,
	invalidSymbolInInitialConditionDiagnosticFactory,
	invalidSymbolInStatementDiagnosticFactory,
	ruleNamingStyleDiagnosticFactory
} from "../message";
import { SignatureCollection } from "../../../mods/signature";
import { getReadableSignatureType } from "../../../mods/story";

export class RuleAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		const signatures = await this.modManager.getAllDefinedSignatures();
		if (!root) return res;

		function doAnalysis(node: ASTNode, thisArg: RuleAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind !== ASTNodeKind.RULE_NODE && child.kind !== ASTNodeKind.SIGNATURE_SECTION_NODE)
					doAnalysis(child, thisArg);
				else if (child.kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
					thisArg.verifySymbolsInFact(child as SignatureSectionNode, signatures, res);
					thisArg.verifyDbNamingStyleInSignatureSection(child as SignatureSectionNode, signatures, res);
				} else {
					thisArg.verifyProcDefinition(child as RuleNode, signatures, res);
					thisArg.verifySymbolsInStatement(child as RuleNode, signatures, res);
					thisArg.verifyDeletionsOnlyFromDatabases([(child as RuleNode).call], signatures, res);
					thisArg.verifyDeletionsOnlyFromDatabases(
						(child as RuleNode).conditions.filter(
							(value) => value.kind === ASTNodeKind.SIGNATURE_NODE
						) as SignatureNode[],
						signatures,
						res
					);
					thisArg.verifyDeletionsOnlyFromDatabases((child as RuleNode).actions, signatures, res);
					thisArg.verifyValidSymbolInInitialCondition(child as RuleNode, signatures, res);
					thisArg.verifyValidFunctionTypeInCondition((child as RuleNode).conditions, signatures, res);
					thisArg.verifyRuleNamingStyle(child as RuleNode, res);
					thisArg.verifyDbNamingStyleInRule(child as RuleNode, signatures, res);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	// InvalidProcDefinition 13
	private verifyProcDefinition(
		rule: RuleNode,
		signatures: SignatureCollection,
		res: Diagnostic[]
	): Diagnostic | undefined {
		if (rule.type !== "PROC" && rule.type !== "QRY") return;
		const signature = signatures.get(rule.call);
		if (!signature) return;
		if (
			(rule.type === "PROC" && signature.type !== "Proc") ||
			(rule.type === "QRY" && signature.type !== "UserQuery")
		) {
			res.push(invalidProcDefinitionDiagnosticFactory({ type: rule.type, range: rule.call.range }));
		}
	}

	// InvalidSymbolInFact 14
	private verifySymbolsInFact(section: SignatureSectionNode, signatures: SignatureCollection, res: Diagnostic[]) {
		return RuleAnalyzer.procSectionVerifierHelper(
			section.content,
			signatures,
			invalidSymbolInStatementDiagnosticFactory,
			true,
			res
		);
	}

	// InvalidSymbolInStatement 15
	private verifySymbolsInStatement(rule: RuleNode, signatures: SignatureCollection, res: Diagnostic[]) {
		return RuleAnalyzer.procSectionVerifierHelper(
			rule.actions,
			signatures,
			invalidSymbolInStatementDiagnosticFactory,
			false,
			res
		);
	}

	private static procSectionVerifierHelper(
		signatureSection: SignatureNode[],
		signatures: SignatureCollection,
		factory: ({ name, type, range, fact }: InvalidSignatureInSectionParams) => Diagnostic,
		isFact: boolean,
		res: Diagnostic[]
	) {
		for (const signature of signatureSection) {
			const type = signatures.get(signature)?.type;
			if (type === "Query" || type === "UserQuery" || type === "SysQuery") {
				res.push(
					factory({
						name: signature.name,
						type: "query",
						range: signature.selectionRange,
						fact: isFact
					})
				);
			}
		}
	}

	// CanOnlyDeleteFromDatabase 16
	private verifyDeletionsOnlyFromDatabases(
		nodes: SignatureNode[],
		signatures: SignatureCollection,
		res: Diagnostic[]
	) {
		for (const node of nodes) {
			if (node.kind !== ASTNodeKind.SIGNATURE_NODE || !node.isDeletion) continue;
			if (signatures.has(node) && signatures.get(node)?.type !== "Database") {
				res.push(invalidDeletionFromNonDatabaseDiagnosticFactory({ range: node.selectionRange }));
			}
		}
	}

	// InvalidSymbolInInitialConition 17
	private verifyValidSymbolInInitialCondition(node: RuleNode, signatures: SignatureCollection, res: Diagnostic[]) {
		let isValid = true;
		if (!signatures.has(node.call)) return;

		const type = signatures.get(node.call)?.type;
		switch (node.type) {
			case "PROC":
				if (type !== "Proc") isValid = false;
				break;
			case "IF":
				if (type !== "Database" && type !== "Event" && type !== "Query") isValid = false;
				break;
			case "QRY":
				if (type !== "UserQuery") isValid = false;
				break;
		}

		if (!isValid) {
			res.push(
				invalidSymbolInInitialConditionDiagnosticFactory({
					range: node.selectionRange,
					ruleType: node.type,
					signatureName: node.call.name,
					signatureType: type ? getReadableSignatureType(type) : undefined
				})
			);
		}
	}

	// InvalidFunctionTypeInCondition 18
	private verifyValidFunctionTypeInCondition(
		conditions: (SignatureNode | ComparisonNode)[],
		signatures: SignatureCollection,
		res: Diagnostic[]
	) {
		for (const condition of conditions) {
			if (condition.kind !== ASTNodeKind.SIGNATURE_NODE) continue;
			const signatureType = signatures.get(condition as SignatureNode)?.type;
			if (
				signatureType &&
				signatureType !== "Query" &&
				signatureType !== "UserQuery" &&
				signatureType !== "Database" &&
				signatureType !== "SysQuery"
			) {
				res.push(
					invalidFunctionTypeInConditionDiagnosticFactory({
						range: condition.selectionRange,
						name: (condition as SignatureNode).name,
						actualType: getReadableSignatureType(signatureType)
					})
				);
			}
		}
	}

	// RuleNamingStyle 23
	private verifyRuleNamingStyle(node: RuleNode, res: Diagnostic[]) {
		if (node.type === "PROC" && !node.call.name.startsWith("PROC_")) {
			res.push(
				ruleNamingStyleDiagnosticFactory({ range: node.call.selectionRange, ruleType: "PROC", prefix: "PROC_" })
			);
		} else if (node.type === "QRY" && !node.call.name.startsWith("QRY_")) {
			res.push(
				ruleNamingStyleDiagnosticFactory({ range: node.call.selectionRange, ruleType: "QRY", prefix: "QRY_" })
			);
		}
	}

	// DbNamingStyle 26
	private verifyDbNamingStyleInRule(node: RuleNode, signatures: SignatureCollection, res: Diagnostic[]) {
		for (const child of node.getNodeChildren()) {
			if (child?.kind !== ASTNodeKind.SIGNATURE_NODE) continue;
			this.verifyDbNamingStyle(child as SignatureNode, signatures, res);
		}
	}

	private verifyDbNamingStyleInSignatureSection(
		node: SignatureSectionNode,
		signatures: SignatureCollection,
		res: Diagnostic[]
	) {
		for (const child of node.content) {
			this.verifyDbNamingStyle(child, signatures, res);
		}
	}

	private verifyDbNamingStyle(child: SignatureNode, signatures: SignatureCollection, res: Diagnostic[]) {
		const signature = signatures.get(child);
		if (signature?.type === "Database" && !signature.name.startsWith("DB_")) {
			res.push(DbNamingStyleDiagnosticFactory({ range: child.selectionRange }));
		}
	}
}
