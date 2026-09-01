import { Diagnostic, Position, Range } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNodeKind, GoalNode, StringNode } from "../../../parser/ast/nodes";
import { goalAlreadyDefinedDiagnosticFactory, unresolvedGoalDiagnosticFactory } from "../message";

export class GoalArrangementAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		if (!root || root.kind !== ASTNodeKind.GOAL_NODE) return res;
		const parentCheck = await this.verifyParentExists();
		if (parentCheck) res.push(parentCheck);
		const nameCheck = await this.verifyUniqueName();
		if (nameCheck) res.push(nameCheck);
		return res;
	}

	// UnresolvedGoal 8
	async verifyParentExists(): Promise<Diagnostic | undefined> {
		const root = await this.resource.getRootNode();
		if (!root || root.kind !== ASTNodeKind.GOAL_NODE) return;
		const parentTargetEdge = (root as GoalNode).footer?.parentTargetEdge;
		if (!parentTargetEdge || parentTargetEdge.kind !== ASTNodeKind.STRING_NODE) return;
		const searchName = (parentTargetEdge as StringNode).value;
		if (
			searchName !== "" &&
			!this.modManager.mod?.getResource(`${searchName}.txt`, "name") &&
			!this.modManager.mod?.getInheritedGoalOwner(searchName)
		) {
			return unresolvedGoalDiagnosticFactory({ range: (parentTargetEdge as StringNode).selectionRange, name: (parentTargetEdge as StringNode).value });
		}
	}

	// GoalAlreadyDefined 7
	async verifyUniqueName(): Promise<Diagnostic | undefined> {
		const resources = this.modManager.getAllResources();
		for (const resource of resources) {
			const filtered = resources.filter((value) => value.name === resource.name);
			if (filtered.length > 1) {
				return goalAlreadyDefinedDiagnosticFactory({ range: Range.create(Position.create(0, 0), Position.create(0, 0)), name: resource.name });
			}
		}
	}
}
