import { Connection, ServerCapabilities, TextDocumentChangeEvent } from "vscode-languageserver";
import { ComponentBase } from "../../componentBase";
import { TextDocument } from "vscode-languageserver-textdocument";
import { decodePath } from "../../utils/pathUtils";
import { UnknownSymbolAnalyzer } from "./analyzers/unknownSymbolAnalyzer";
import { ComparisonAnalyzer } from "./analyzers/comparisonAnalyzer";
import { SignatureAnalyzer } from "./analyzers/signatureAnalyzer";
import { GoalArrangementAnalyzer } from "./analyzers/goalArrangementAnalyzer";
import { RuleAnalyzer } from "./analyzers/ruleAnalyzer";

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

-- Types --
UnresolvedVariableType 9
UnresolvedSignature 10
UnresolvedType 12

TODO: Change signature registration to only defined signatures, not signatures in bodies of rules
TODO: Combine signature types into one so signatures and inherited signatures are not treated differently?
TODO: Add signature usage locations to class

-- Function Placements --
*InvalidProcDefinition 13
*InvalidSymbolInFact 14
*InvalidSymbolInStatement 15
*CanOnlyDeleteFromDatabase 16
*InvalidSymbolInInitialCondition 17
*InvalidFunctionTypeInCondition 18

-- Function Naming --
RuleNamingStyle 23
DbNamingStyle 26

-- Symbol Resolving --
UnresolvedSymbol 19
*UnusedDatabaseWarning 25
UnwrittenDatabase 35

-- Comparisons --
*StringLtGtComparison 20
*BinaryOperationSameRhsLhs 33
*RiskyComparison 34

-- Parameters --
LocalTypeMismatch 11
ParamNotBound 24
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
*/

export class DiagnosticManager extends ComponentBase {
	connection?: Connection;

	private readonly analyzers = [ComparisonAnalyzer, SignatureAnalyzer, GoalArrangementAnalyzer, RuleAnalyzer];

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
		const file = this.server.modManager.findResource(decodePath(event.document.uri));
		if (file) {
			if (event.document.version >= file.getTextDocument().version) {
				file.setTextDocument(event.document);
			}
			this.handleDiagnostics(event.document);
		}
	};

	handleDidChangeContent = async (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.server.modManager.findResource(decodePath(event.document.uri));
		if (file) {
			file.setTextDocument(event.document);
			file.invalidate();
			this.handleDiagnostics(event.document);
		}
	};

	async handleDiagnostics(document: TextDocument): Promise<void> {
		const resource = this.server.modManager.findResource(decodePath(document.uri));
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
