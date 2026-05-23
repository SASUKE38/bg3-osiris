import { Diagnostic } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	IdentifierNode,
	SingletonNode
} from "../../../parser/ast/nodes";
import { binaryOperationSameRhsLhsDiagnosticFactory, stringLtGtComparisonDiagnosticFactory } from "../message";

export class ComparisonAnalyzer extends AnalyzerBase {
	private readonly nonEqualityOperators = ["<", ">", "<=", ">="];
	private readonly sameTypeKinds = [ASTNodeKind.STRING_NODE, ASTNodeKind.NUMBER_NODE, ASTNodeKind.IDENTIFIER_NODE];

	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		if (!root) return res;

		function doAnalysis(node: ASTNode, thisArg: ComparisonAnalyzer) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.COMPARISON_NODE) {
					thisArg.verifyNoStringLtGtComparison(res, child as ComparisonNode, thisArg);
					thisArg.verifyNobinaryOperationSameRhsLhs(res, child as ComparisonNode, thisArg);
				} else {
					doAnalysis(child, thisArg);
				}
			}
		}

		doAnalysis(root, this);
		return res;
	}

	// StringLtGtComparison 20
	private verifyNoStringLtGtComparison(res: Diagnostic[], child: ComparisonNode, thisArg: ComparisonAnalyzer) {
		const left = child.left;
		const operator = child.operator;
		const right = child.right;

		if (
			(left.kind === ASTNodeKind.STRING_NODE ||
				right.kind === ASTNodeKind.STRING_NODE ||
				(left.kind === ASTNodeKind.IDENTIFIER_NODE && !(left as IdentifierNode).value.startsWith("_")) ||
				(right.kind === ASTNodeKind.IDENTIFIER_NODE && !(right as IdentifierNode).value.startsWith("_"))) &&
			thisArg.nonEqualityOperators.find((value) => value === operator.value)
		) {
			res.push(stringLtGtComparisonDiagnosticFactory({ comparison: child }));
		}
	}

	// BinaryOperationSameRhsLhs 33
	private verifyNobinaryOperationSameRhsLhs(res: Diagnostic[], child: ComparisonNode, thisArg: ComparisonAnalyzer) {
		const left = child.left;
		const right = child.right;

		if (
			thisArg.sameTypeKinds.find((value) => value === left.kind && value === right.kind) &&
			((left as SingletonNode<string>).value === (right as SingletonNode<string>).value ||
				(left as SingletonNode<number>).value === (right as SingletonNode<number>).value)
		) {
			res.push(binaryOperationSameRhsLhsDiagnosticFactory({ comparison: child }));
		}
	}
}
