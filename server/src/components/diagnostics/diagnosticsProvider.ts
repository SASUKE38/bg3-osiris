import { Connection, ServerCapabilities, TextDocumentChangeEvent } from "vscode-languageserver";
import { ComponentBase } from "../../componentBase";
import { TextDocument } from "vscode-languageserver-textdocument";
import { decodePath } from "../../utils/pathUtils";

/*
=== Header Only ===
TypeIdAlreadyDefined 1
TypeNameAlreadyDefined 2
TypeIdInvalid 3
IntrinsicTypeIdInvalid 4
UnresolvedTypeInSignature 6

=== Parser Updates ===
GoalAlreadyDefined 7
UnresolvedGoal 8
InvalidProcDefinition 13
InvalidSymbolInFact 14
InvalidSymbolInStatement 15
CanOnlyDeleteFromDatabase 16
InvalidSymbolInInitialCondition 17
InvalidFunctionTypeInCondition 18
StringLtGtComparison 20
RuleNamingStyle 23
DbNamingStyle 26
ProcTypeMismatch 30
CastToUnrelatedType 31
BinaryOperationSameRhsLhs 33
RiskyComparison 34

=== Analyzer-Specific ===
UnresolvedVariableType 9
UnresolvedSignature 10
LocalTypeMismatch 11
UnresolvedSymbol 19
ParamNotBound 24
UnusedDatabaseWarning 25
CastToUnrelatedGuidAlias 32
UnwrittenDatabase 35

=== Unknown or Not Possible in Context ===
SignatureAlreadyDefined 5
UnresolvedType 12
GuidAliasMismatch 21
GuidPrefixNotKnown 22
UnresolvedGameObjectName 27
GameObjectTypeMismatch 28
GameObjectNameMismatch 29
*/

export class DiagnosticProvider extends ComponentBase {
	connection?: Connection;

	getCapabilities(): Partial<ServerCapabilities> {
		return {};
	}

	initializeComponent(connection: Connection): void {
		this.connection = connection;
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
			this.handleDiagnostics(event);
		}
	};

	handleDidChangeContent = async (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.server.modManager.findResource(decodePath(event.document.uri));
		if (file) {
			file.setTextDocument(event.document);
			file.invalidate();
			this.handleDiagnostics(event);
		}
	};

	async handleDiagnostics(event: TextDocumentChangeEvent<TextDocument>) {
		const resource = this.server.modManager.findResource(decodePath(event.document.uri));
		if (resource) {
			await this.connection?.sendDiagnostics({
				uri: event.document.uri,
				diagnostics: await resource.getDiagnostics()
			});
		}
	}
}
