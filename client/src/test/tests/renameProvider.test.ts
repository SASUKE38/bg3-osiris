import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Rename Provider", () => {
	const epiDocUri = getDocUri("Act3c_EPI_Emperor.txt");
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");
	const gloDocUri = getDocUri("GLO_EmperorEpilogueTracking.txt");

	test("Attempt to rename number should return a rejected promise", async () => {
		await testRename(epiDocUri, new vscode.Position(174, 180), "somenewname");
	});

	test("Attempt to rename string should return a rejected promise", async () => {
		await testRename(epiDocUri, new vscode.Position(44, 39), "somenewname");
	});

	test("Attempt to rename enum should return a rejected promise", async () => {
		await testRename(endDocUri, new vscode.Position(95, 94), "somenewname");
	});

	test("Attempt to rename constant should rename all instances in the project", async () => {
		const newName = "New_Name-22222222-2222-2222-2222-222222222222";
		const edit = new vscode.WorkspaceEdit();
		edit.replace(endDocUri, toRange(3, 50, 3, 120), newName);
		edit.replace(endDocUri, toRange(11, 37, 11, 107), newName);
		edit.replace(endDocUri, toRange(11, 112, 11, 182), newName);
		edit.replace(gloDocUri, toRange(14, 14, 14, 84), newName);
		edit.replace(gloDocUri, toRange(33, 14, 33, 84), newName);
		edit.replace(gloDocUri, toRange(51, 14, 51, 84), newName);
		edit.replace(gloDocUri, toRange(77, 14, 77, 84), newName);
		await testRename(endDocUri, new vscode.Position(11, 66), newName, edit);
	});

	test("Attempt to rename user-defined signature should rename all instances and overloads in the project", async () => {
		const newName = "PROC_CoolSignatureName";
		const edit = new vscode.WorkspaceEdit();
		edit.replace(endDocUri, toRange(157, 0, 157, 41), newName);
		edit.replace(endDocUri, toRange(162, 0, 162, 41), newName);
		edit.replace(epiDocUri, toRange(228, 0, 228, 41), newName);
		edit.replace(epiDocUri, toRange(253, 0, 253, 41), newName);
		edit.replace(epiDocUri, toRange(260, 0, 260, 41), newName);
		edit.replace(epiDocUri, toRange(275, 0, 275, 41), newName);
		edit.replace(epiDocUri, toRange(290, 0, 290, 41), newName);
		await testRename(endDocUri, new vscode.Position(162, 37), newName, edit);
	});
	epiDocUri;

	test("Attempt to rename builtin signature should return a rejected promise", async () => {
		await testRename(endDocUri, new vscode.Position(32, 5), "somenewname");
	});

	test("Attempt to rename overloaded builtin should return a rejected promise", async () => {
		await testRename(epiDocUri, new vscode.Position(351, 9), "someCoolName");
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
		await assert.rejects(
			async () => {
				return await vscode.commands.executeCommand(
					"vscode.executeDocumentRenameProvider",
					docUri,
					position,
					newName
				);
			},
			{ name: "Error", message: "The element can't be renamed." }
		);
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
