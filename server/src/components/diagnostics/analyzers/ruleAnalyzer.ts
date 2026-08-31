import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import {
	ASTNode,
	ASTNodeKind,
	RuleNode,
	SignatureNode,
	SignatureSectionNode
} from "../../../parser/ast/nodes";
import {
	invalidDeletionFromNonDatabaseDiagnosticFactory,
	invalidProcDefinitionDiagnosticFactory,
	InvalidSignatureInSectionParams,
	invalidSymbolInInitialConditionDiagnosticFactory,
	invalidSymbolInStatementDiagnosticFactory
} from "../message";
import { getReadableSignatureType, Signature, SignatureType } from "../../../mods/signature";
import { InheritedSignature } from "../../../mods/mod";

export class RuleAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		const signatures = await this.modManager.getAllDefinedSignatures();
		const inheritedSignatures = this.modManager.mod?.getAllInheritedSignatures();
		if (!root) return res;

		function doAnalysis(node: ASTNode, thisArg: RuleAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind !== ASTNodeKind.RULE_NODE && child.kind !== ASTNodeKind.SIGNATURE_SECTION_NODE)
					doAnalysis(child, thisArg);
				else if (child.kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
					thisArg.verifySymbolsInFact(child as SignatureSectionNode, signatures, res, inheritedSignatures);
				} else {
					thisArg.verifyProcDefinition(child as RuleNode, signatures, res, inheritedSignatures);
					thisArg.verifySymbolsInStatement(child as RuleNode, signatures, res, inheritedSignatures);
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
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	// InvalidProcDefinition 13
	private verifyProcDefinition(
		rule: RuleNode,
		signatures: Map<string, Signature>,
		res: Diagnostic[],
		inheritedSignatures?: Map<string, InheritedSignature[]>
	): Diagnostic | undefined {
		if (rule.type !== "PROC" && rule.type !== "QRY") return;
		const signature = signatures.get(rule.call.name);
		const inheritedSignature = inheritedSignatures?.get(rule.call.name);
		if (signature) {
			if (
				(rule.type === "PROC" && signature.type !== SignatureType.Proc) ||
				(rule.type === "QRY" && signature.type !== SignatureType.Query)
			) {
				res.push(invalidProcDefinitionDiagnosticFactory({ type: rule.type, range: rule.call.range }));
			}
		} else if (inheritedSignature) {
			if (!rule.call.name.startsWith(`${rule.type}_`)) {
				res.push(invalidProcDefinitionDiagnosticFactory({ type: rule.type, range: rule.call.range }));
			}
		}
	}

	// InvalidSymbolInFact 14
	private verifySymbolsInFact(
		section: SignatureSectionNode,
		signatures: Map<string, Signature>,
		res: Diagnostic[],
		inheritedSignatures?: Map<string, InheritedSignature[]>
	) {
		return RuleAnalyzer.procSectionVerifierHelper(
			section.content,
			signatures,
			invalidSymbolInStatementDiagnosticFactory,
			true,
			res,
			inheritedSignatures
		);
	}

	// InvalidSymbolInStatement 15
	private verifySymbolsInStatement(
		rule: RuleNode,
		signatures: Map<string, Signature>,
		res: Diagnostic[],
		inheritedSignatures?: Map<string, InheritedSignature[]>
	) {
		return RuleAnalyzer.procSectionVerifierHelper(
			rule.actions,
			signatures,
			invalidSymbolInStatementDiagnosticFactory,
			false,
			res,
			inheritedSignatures
		);
	}

	private static procSectionVerifierHelper(
		signatureSection: SignatureNode[],
		signatures: Map<string, Signature>,
		factory: ({ name, type, range, fact }: InvalidSignatureInSectionParams) => Diagnostic,
		isFact: boolean,
		res: Diagnostic[],
		inheritedSignatures?: Map<string, InheritedSignature[]>
	) {
		for (const signature of signatureSection) {
			const type = signatures.get(signature.name)?.type;
			const inheritedSignature = inheritedSignatures?.get(signature.name);
			if (type === SignatureType.Query || type === SignatureType.BuiltinQuery || type === SignatureType.Unknown) {
				res.push(
					factory({
						name: signature.name,
						type: type === SignatureType.Query || type === SignatureType.BuiltinQuery ? "query" : "unknown",
						range: signature.selectionRange,
						fact: isFact
					})
				);
			} else if (inheritedSignature && inheritedSignature[0].name.startsWith("QRY_")) {
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
		signatures: Map<string, Signature>,
		res: Diagnostic[]
	) {
		for (const node of nodes) {
			if (node.kind !== ASTNodeKind.SIGNATURE_NODE || !node.isDeletion) continue;
			if (
				(signatures.has(node.name) && signatures.get(node.name)?.type !== SignatureType.Database) ||
				!node.name.startsWith("DB_")
			) {
				res.push(invalidDeletionFromNonDatabaseDiagnosticFactory({ range: node.selectionRange }));
			}
		}
	}

	// InvalidSymbolInInitialConition 17
	// TODO: Finish this for inherited signatures
	private verifyValidSymbolInInitialCondition(node: RuleNode, signatures: Map<string, Signature>, res: Diagnostic[]) {
		let isValid = true;
		const type = signatures.get(node.call.name)?.type;
		if (type) {
			switch (node.type) {
				case "PROC":
					if (type !== SignatureType.Proc) isValid = false;
					break;
				case "IF":
					if (type !== SignatureType.Database && type !== SignatureType.BuiltinEvent) isValid = false;
					break;
				case "QRY":
					if (type !== SignatureType.Query) isValid = false;
					break;
			}
		} else {
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
}
