import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("References Provider", () => {
	const epiDocUri = getDocUri("Act3c_EPI_Emperor.txt");
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");

	suite("References", () => {
		test("Finding references of constant should get all instances of the constant in the workspace", async () => {
			await testReferences(epiDocUri, new vscode.Position(262, 59), [
				{ uri: endDocUri, range: toRange(14, 60, 14, 113) },
				{ uri: endDocUri, range: toRange(92, 108, 92, 161) },
				{ uri: endDocUri, range: toRange(95, 29, 95, 82) },
				{ uri: endDocUri, range: toRange(96, 11, 96, 64) },
				{ uri: endDocUri, range: toRange(98, 6, 98, 59) },
				{ uri: endDocUri, range: toRange(112, 131, 112, 184) },
				{ uri: endDocUri, range: toRange(122, 22, 122, 75) },
				{ uri: endDocUri, range: toRange(152, 39, 152, 92) },
				{ uri: endDocUri, range: toRange(157, 64, 157, 117) },
				{ uri: epiDocUri, range: toRange(64, 46, 64, 99) },
				{ uri: epiDocUri, range: toRange(262, 11, 262, 64) },
				{ uri: epiDocUri, range: toRange(264, 86, 264, 139) },
				{ uri: epiDocUri, range: toRange(270, 32, 270, 85) }
			]);
		});

		test("Finding references of signature should get all instances of the signature in the workspace", async () => {
			await testReferences(epiDocUri, new vscode.Position(155, 34), [
				{ uri: endDocUri, range: toRange(14, 0, 14, 48) },
				{ uri: endDocUri, range: toRange(157, 4, 157, 52) },
				{ uri: epiDocUri, range: toRange(70, 0, 70, 48) },
				{ uri: epiDocUri, range: toRange(71, 0, 71, 48) },
				{ uri: epiDocUri, range: toRange(72, 0, 72, 48) },
				{ uri: epiDocUri, range: toRange(73, 9, 73, 57) },
				{ uri: epiDocUri, range: toRange(74, 0, 74, 48) },
				{ uri: epiDocUri, range: toRange(75, 0, 75, 48) },
				{ uri: epiDocUri, range: toRange(76, 0, 76, 48) },
				{ uri: epiDocUri, range: toRange(77, 0, 77, 48) },
				{ uri: epiDocUri, range: toRange(155, 4, 155, 52) }
			]);
		});

		test("Finding references of variable should get all instances of the variable in the containing rule", async () => {
			await testReferences(epiDocUri, new vscode.Position(319, 52), [
				{ uri: epiDocUri, range: toRange(311, 22, 311, 29) },
				{ uri: epiDocUri, range: toRange(313, 83, 313, 90) },
				{ uri: epiDocUri, range: toRange(315, 90, 315, 97) },
				{ uri: epiDocUri, range: toRange(319, 45, 319, 52) },
				{ uri: epiDocUri, range: toRange(320, 36, 320, 43) }
			]);
		});

		test("Finding references of number should get no references", async () => {
			await testReferences(epiDocUri, new vscode.Position(326, 38), []);
		});

		test("Finding references of string should get no references", async () => {
			await testReferences(epiDocUri, new vscode.Position(176, 47), []);
		});

		test("Finding references of enum should get no references", async () => {
			await testReferences(endDocUri, new vscode.Position(93, 88), []);
		});

		test("Finding references of type should get no references", async () => {
			await testReferences(epiDocUri, new vscode.Position(174, 22), []);
		});
	});

	suite("Document Highlight", () => {
		test("Cursor on constant should highlight all instances of the constant in the document", async () => {
			await testDocumentHighlight(epiDocUri, new vscode.Position(24, 64), [
				{ range: toRange(24, 27, 24, 95), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(25, 26, 25, 94), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(356, 38, 356, 106), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on left edge of signature should highlight all instances of the signature in the document", async () => {
			await testDocumentHighlight(epiDocUri, new vscode.Position(8, 0), [
				{ range: toRange(6, 5, 6, 39), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(7, 0, 7, 34), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(8, 0, 8, 34), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(226, 0, 226, 34), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on right edge of signature should highlight all instances of the signature in the document", async () => {
			await testDocumentHighlight(epiDocUri, new vscode.Position(15, 43), [
				{ range: toRange(15, 2, 15, 43), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(16, 0, 16, 41), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(239, 0, 239, 41), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on variable should highlight instances of the variable in rule in the document", async () => {
			await testDocumentHighlight(epiDocUri, new vscode.Position(90, 28), [
				{ range: toRange(84, 39, 84, 46), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(90, 25, 90, 32), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(91, 15, 91, 22), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on whitespace should highlight nothing", async () => {
			await testDocumentHighlight(epiDocUri, new vscode.Position(178, 22), []);
		});
	});
});

async function testReferences(docUri: vscode.Uri, position: vscode.Position, expectedLocationList: vscode.Location[]) {
	await activate(docUri);

	const actualLocationList = (await vscode.commands.executeCommand(
		"vscode.executeReferenceProvider",
		docUri,
		position
	)) as vscode.Location[];

	assert.ok(actualLocationList.length === expectedLocationList.length);
	expectedLocationList.forEach((expectedLocation, i) => {
		assert.strictEqual(actualLocationList[i].uri.toString(), expectedLocation.uri.toString());
		assert.deepStrictEqual(actualLocationList[i].range, expectedLocation.range);
	});
}

async function testDocumentHighlight(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedHighlightList: vscode.DocumentHighlight[]
) {
	await activate(docUri);

	const actualHighlightList = (await vscode.commands.executeCommand(
		"vscode.executeDocumentHighlights",
		docUri,
		position
	)) as vscode.DocumentHighlight[];

	assert.ok(actualHighlightList.length === expectedHighlightList.length);
	expectedHighlightList.forEach((expectedHighlight, i) => {
		assert.deepStrictEqual(actualHighlightList[i].range, expectedHighlight.range);
		assert.strictEqual(actualHighlightList[i].kind, expectedHighlight.kind);
	});
}
