import { CancellationToken, TextDocumentContentProvider, Uri, window } from "vscode";
import { clients } from "../extension";
import {
	requestGetInheritedGoalContent,
	RequestGetInheritedGoalContentParams,
	RequestGetInheritedGoalContentResult
} from "bg3-osiris-shared";

export class InheritedGoalContentProvider implements TextDocumentContentProvider {
	static readonly scheme = "bg3Osiris.InheritedGoal";

	async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string | null | undefined> {
		const client = clients.get(uri.query);
		if (!client) {
			window.showErrorMessage(`Couldn't find client for ${uri.query}. Goal content cannot be shown.`);
			return;
		}

		const params: RequestGetInheritedGoalContentParams = { goalName: uri.path.substring(0, uri.path.length - 4) };
		const content = (
			(await client.connection.sendRequest(
				requestGetInheritedGoalContent,
				params
			)) as RequestGetInheritedGoalContentResult
		).content;
		if (!content) {
			window.showErrorMessage(`Couldn't get content for ${uri.path}. Goal content cannot be shown.`);
			return "";
		}
		return content;
	}
}
