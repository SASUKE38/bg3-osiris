import { Diagnostic, Position, Range } from "vscode-languageserver";
import { AnalyzerBase } from "./analyzerBase";
import { ASTNodeKind, GoalNode, StringNode } from "../../../parser/ast/nodes";
import { goalAlreadyDefinedDiagnosticFactory, unresolvedGoalDiagnosticFactory } from "../message";

export class GoalArrangementAnalyzer extends AnalyzerBase {
	async analyze(): Promise<Diagnostic[]> {
		const res: Diagnostic[] = [];
		const root = await this.resource.getRootNode();
		if (!root || root.kind !== ASTNodeKind.GOAL_NODE) return res;
		await this.verifyParentsExist(res);
		await this.verifyUniqueName(res);
		return res;
	}

	// UnresolvedGoal 8
	async verifyParentsExist(res: Diagnostic[]) {
		const root = await this.resource.getRootNode();
		if (!root || root.kind !== ASTNodeKind.GOAL_NODE) return;
		const parents = (root as GoalNode).footer?.parents;
		if (!parents) return;
		for (const parent of parents) {
			if (parent.kind !== ASTNodeKind.STRING_NODE) continue;
			const searchName = (parent as StringNode).value;
			if (
				searchName !== "" &&
				!this.modManager.mod?.getGoalResource(`${searchName}.txt`, "name") &&
				!this.modManager.mod?.getInheritedGoalOwner(searchName)
			) {
				res.push(
					unresolvedGoalDiagnosticFactory({
						range: (parent as StringNode).selectionRange,
						name: (parent as StringNode).value
					})
				);
			}
		}
	}

	// GoalAlreadyDefined 7
	async verifyUniqueName(res: Diagnostic[]) {
		const resources = this.modManager.getAllResources();
		for (const resource of resources) {
			const filtered = resources.filter((value) => value.name === resource.name);
			if (filtered.length > 1) {
				res.push(
					goalAlreadyDefinedDiagnosticFactory({
						range: Range.create(Position.create(0, 0), Position.create(0, 0)),
						name: resource.name
					})
				);
			}
		}
	}
}
