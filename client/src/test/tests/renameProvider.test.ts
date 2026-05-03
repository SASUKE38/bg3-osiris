import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Rename Provider", () => {
	const epiDocUri = getDocUri("Act3c_EPI_Emperor.txt");
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");

	test("Attempt to rename number should return a rejected promise", async () => {
		await testRename(epiDocUri, new vscode.Position(174, 180), "somenewname");
	});

	test("Attempt to rename string should return a rejected promise", async () => {
		await testRename(epiDocUri, new vscode.Position(44, 39), "somenewname");
	});

	test("Attempt to rename enum should return a rejected promise", async () => {
		await testRename(endDocUri, new vscode.Position(95, 94), "somenewname");
	});

	test("Attempt to rename constant in signature section should give a range and placeholder only within the signature", async () => {
		const newName = "2c76687d-93a2-477b-8b18-8a14b549304c";
		const edit = new vscode.WorkspaceEdit();
		edit.replace(endDocUri, toRange(4, 44, 4, 94), newName);
		await testRename(endDocUri, new vscode.Position(4, 65), newName, edit);
	});

	test("Attempt to rename constant in rule should give a range and placeholder only within the rule", async () => {
		const newName = "2c76687d-93a2-477b-8b18-8a14b549304c";
		const edit = new vscode.WorkspaceEdit();
		edit.replace(epiDocUri, toRange(453, 13, 453, 63), newName);
		edit.replace(epiDocUri, toRange(461, 125, 461, 175), newName);
		await testRename(epiDocUri, new vscode.Position(461, 140), newName, edit);
	});

	test("Attempt to rename variable should give a range and placeholder", async () => {
		const newName = "_NewPlayer";
		const edit = new vscode.WorkspaceEdit();
		edit.replace(epiDocUri, toRange(420, 22, 420, 29), newName);
		edit.replace(epiDocUri, toRange(422, 83, 422, 90), newName);
		edit.replace(epiDocUri, toRange(426, 123, 426, 130), newName);
		await testRename(epiDocUri, new vscode.Position(422, 88), newName, edit);
	});
});

async function testRename(
	docUri: vscode.Uri,
	position: vscode.Position,
	newName: string,
	expectedWorkspaceEdit?: vscode.WorkspaceEdit
) {
	await activate(docUri);

	if (!expectedWorkspaceEdit) {
		assert.rejects(async () => {
			return await vscode.commands.executeCommand(
				"vscode.executeDocumentRenameProvider",
				docUri,
				position,
				newName
			);
		});
	} else {
		const actualWorkspaceEdit = (await vscode.commands.executeCommand(
			"vscode.executeDocumentRenameProvider",
			docUri,
			position,
			newName
		)) as vscode.WorkspaceEdit;

		assert.ok(actualWorkspaceEdit.size === expectedWorkspaceEdit.size);
		expectedWorkspaceEdit.entries().forEach((entry) => {
			if (!actualWorkspaceEdit.has(entry[0])) {
				assert.fail("URI missing from actual WorkspaceEdit.");
			}
			const actualEntry = actualWorkspaceEdit.get(entry[0]);
			assert.deepStrictEqual(actualEntry, entry[1]);
		});
	}
}
