import { Diagnostic, Location } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNode, ASTNodeKind, RuleNode, SignatureNode } from "../../../parser/ast/nodes";
import { unusedDatabaseWarningDiagnosticFactory } from "../message";

export class UnknownSymbolAnalyzer extends AnalyzerBase {
	unresolvedSymbols = new Map<string, Location[]>();

	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const document = this.resource.getTextDocument();
		const root = await this.resource.getRootNode();
		if (!root) return res;

		const { calledSignatureToFileMap } = this.modManager;
		const { fileToCalledSignatureMap } = this.modManager;
		const signatures = await this.modManager.getAllDefinedSignatures();
		const readDatabases = await this.modManager.getReadDatabases();
		const writtenDatabases = await this.modManager.getWrittenDatabases();

		function doAnalysis(node: ASTNode, thisArg: UnknownSymbolAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.SIGNATURE_NODE) {
					thisArg.verifyDatabaseUses(child as SignatureNode, readDatabases, writtenDatabases, res);
				} else {
					doAnalysis(child, thisArg);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	private verifyDatabaseUses(
		child: SignatureNode,
		readDatabases: Set<string>,
		writtenDatabases: Set<string>,
		res: Diagnostic[]
	) {
		if (!readDatabases.has(child.name) && writtenDatabases.has(child.name)) {
			res.push(
				unusedDatabaseWarningDiagnosticFactory({ range: child.selectionRange, name: child.name, isRead: false })
			);
		} else if (readDatabases.has(child.name) && !writtenDatabases.has(child.name)) {
			res.push(
				unusedDatabaseWarningDiagnosticFactory({ range: child.selectionRange, name: child.name, isRead: true })
			);
		}
	}
}
