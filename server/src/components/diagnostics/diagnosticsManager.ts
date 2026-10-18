import { Connection, ServerCapabilities, TextDocumentChangeEvent } from "vscode-languageserver";
import { ComponentBase } from "../../componentBase";
import { TextDocument } from "vscode-languageserver-textdocument";
import { decodePath } from "../../utils/pathUtils";
import { UnknownSymbolAnalyzer } from "./analyzers/unknownSymbolAnalyzer";
import { ComparisonAnalyzer } from "./analyzers/comparisonAnalyzer";
import { SignatureAnalyzer } from "./analyzers/signatureAnalyzer";
import { GoalArrangementAnalyzer } from "./analyzers/goalArrangementAnalyzer";
import { RuleAnalyzer } from "./analyzers/ruleAnalyzer";
import { ParameterAnalyzer } from "./analyzers/parameterAnalyzer";
import { watch } from "fs";

/*
=== Header Only ===
TypeIdAlreadyDefined 1
TypeNameAlreadyDefined 2
TypeIdInvalid 3
IntrinsicTypeIdInvalid 4
UnresolvedTypeInSignature 6

=== Analyzers ===
-- Goal Arrangement --
*GoalAlreadyDefined 7
*UnresolvedGoal 8

-- Function Placements --
*InvalidProcDefinition 13
*InvalidSymbolInFact 14
*InvalidSymbolInStatement 15
*CanOnlyDeleteFromDatabase 16
*InvalidSymbolInInitialCondition 17
*InvalidFunctionTypeInCondition 18

-- Function Naming --
*RuleNamingStyle 23
*DbNamingStyle 26

TODO: Figure out how to handle orphans with databases
TODO: Delete this comment

-- Symbol Resolving --
*UnresolvedSymbol 19
*UnusedDatabaseWarning 25

-- Comparisons --
*StringLtGtComparison 20
*BinaryOperationSameRhsLhs 33
*RiskyComparison 34

-- Parameters --
UnresolvedVariableType 9
UnresolvedSignature 10
LocalTypeMismatch 11
*ParamNotBound 24
ProcTypeMismatch 30
CastToUnrelatedType 31
CastToUnrelatedGuidAlias 32

=== Unknown or Not Possible in Context ===
SignatureAlreadyDefined 5
UnresolvedType 12
GuidAliasMismatch 21
GuidPrefixNotKnown 22
UnresolvedGameObjectName 27
GameObjectTypeMismatch 28
GameObjectNameMismatch 29
UnwrittenDatabase 35
*/

export class DiagnosticManager extends ComponentBase {
	connection?: Connection;

	private readonly analyzers = [
		ComparisonAnalyzer,
		SignatureAnalyzer,
		GoalArrangementAnalyzer,
		RuleAnalyzer,
		UnknownSymbolAnalyzer,
		ParameterAnalyzer
	];

	getCapabilities(): Partial<ServerCapabilities> {
		return {};
	}

	initializeComponent(connection: Connection): void {
		this.connection = connection;
	}

	installHandlers() {
		const { documents } = this.server;
		documents.onDidOpen(this.handleDidOpen);
		documents.onDidChangeContent(this.handleDidChangeContent);
	}

	handleDidOpen = async (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.server.modManager.findGoalResource(decodePath(event.document.uri));
		if (file) {
			if (event.document.version >= file.getTextDocument().version) {
				file.setTextDocument(event.document);
			}
			this.handleDiagnostics(event.document);
		}
	};

	handleDidChangeContent = async (event: TextDocumentChangeEvent<TextDocument>) => {
		const path = decodePath(event.document.uri);
		const file = this.server.modManager.findGoalResource(path);
		if (!file) return;

		file.setTextDocument(event.document);
		file.invalidate();
		this.handleDiagnostics(event.document);

		const signatures = this.server.modManager.fileToSignatureMap.get(path);
		if (!signatures) return;
		const visited = new Set<string>();
		visited.add(path);

		for (const signature of signatures) {
			const referencedFiles = this.server.modManager.signatureToFileMap.get(signature);
			if (!referencedFiles) continue;
			for (const referencedFile of referencedFiles) {
				if (visited.has(referencedFile)) continue;
				const referencedResource = this.server.modManager.findGoalResource(referencedFile);
				if (!referencedResource) continue;
				this.handleDiagnostics(referencedResource.getTextDocument())
				visited.add(referencedFile);
			}
		}
	};

	async handleDiagnostics(document: TextDocument): Promise<void> {
		const resource = this.server.modManager.findGoalResource(decodePath(document.uri));
		if (!resource) return;
		const semanticDiagnostics = (
			await Promise.all(
				this.analyzers.map(async (analyzer) => new analyzer(resource, this.server.modManager).analyze())
			)
		).flat(1);
		this.connection?.sendDiagnostics({
			uri: document.uri,
			diagnostics: [...semanticDiagnostics, ...(await resource.getData("diagnostics"))]
		});
	}
}
