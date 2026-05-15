import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Call Hierarchy Provider", () => {
	const epiDocUri = getDocUri("Act3c_EPI_Emperor.txt");
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");
	const gloDocUri = getDocUri("GLO_EmperorEpilogueTracking.txt");

	suite("Prepare Call Hierarchy", () => {
		test("Preparing a call hierarchy for a signature should return call hierarchy items", async () => {
			await testPrepareCallHierarchy(epiDocUri, new vscode.Position(228, 11), [
				{
					name: "QRY_EPI_Epilogue_EmperorRootLetterIsValid",
					kind: vscode.SymbolKind.Function,
					uri: epiDocUri,
					range: toRange(228, 0, 228, 63),
					selectionRange: toRange(228, 0, 228, 41)
				}
			]);
		});

		test("Preparing a call hierarchy for a whitespace should return nothing", async () => {
			await testPrepareCallHierarchy(epiDocUri, new vscode.Position(449, 0), []);
		});
	});

	suite("Incoming Calls", () => {
		test("Requesting incoming calls for a signature with callers should get an array of its callers", async () => {
			await testIncomingCalls(epiDocUri, new vscode.Position(420, 8), [
				{
					from: {
						name: "DialogEnded",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(309, 0, 309, 91),
						selectionRange: toRange(309, 0, 309, 11)
					},
					fromRanges: [toRange(309, 0, 309, 11)]
				},
				{
					from: {
						name: "DialogEnded",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(414, 0, 414, 25),
						selectionRange: toRange(414, 0, 414, 11)
					},
					fromRanges: [toRange(414, 0, 414, 11)]
				},
				{
					from: {
						name: "DB_GlobalFlag",
						kind: vscode.SymbolKind.Function,
						uri: gloDocUri,
						range: toRange(22, 0, 22, 98),
						selectionRange: toRange(22, 0, 22, 13)
					},
					fromRanges: [toRange(22, 0, 22, 13)]
				}
			]);
		});

		test("Requesting incoming calls for a signature with no callers should get an empty array", async () => {
			await testIncomingCalls(epiDocUri, new vscode.Position(337, 9), []);
		});
	});

	suite("Outgoing Calls", () => {
		test("Requesting outgoing calls for a signature with calls should get an array of its calls", async () => {
			await testOutgoingCalls(endDocUri, new vscode.Position(108, 4), [
				{
					to: {
						name: "DB_GlobalFlag",
						kind: vscode.SymbolKind.Function,
						uri: endDocUri,
						range: toRange(110, 0, 110, 82),
						selectionRange: toRange(110, 0, 110, 13)
					},
					fromRanges: [toRange(110, 0, 110, 13)]
				},
				{
					to: {
						name: "DB_END_GameFinale_QueuedSoloSpeaker",
						kind: vscode.SymbolKind.Function,
						uri: endDocUri,
						range: toRange(112, 0, 112, 185),
						selectionRange: toRange(112, 0, 112, 35)
					},
					fromRanges: [toRange(112, 0, 112, 35)]
				},
				{
					to: {
						name: "DB_END_GameFinale_FatesGroupDialogues",
						kind: vscode.SymbolKind.Function,
						uri: endDocUri,
						range: toRange(113, 0, 113, 121),
						selectionRange: toRange(113, 0, 113, 37)
					},
					fromRanges: [toRange(113, 0, 113, 37)]
				},
				{
					to: {
						name: "DB_GlobalFlag",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(166, 0, 166, 75),
						selectionRange: toRange(166, 0, 166, 13)
					},
					fromRanges: [toRange(166, 0, 166, 13)]
				},
				{
					to: {
						name: "DB_GlobalFlag",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(168, 0, 168, 100),
						selectionRange: toRange(168, 0, 168, 13)
					},
					fromRanges: [toRange(168, 0, 168, 13)]
				},
				{
					to: {
						name: "DB_Players",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(170, 0, 170, 19),
						selectionRange: toRange(170, 0, 170, 10)
					},
					fromRanges: [toRange(170, 0, 170, 10)]
				},
				{
					to: {
						name: "GetFlag",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(172, 0, 172, 94),
						selectionRange: toRange(172, 0, 172, 7)
					},
					fromRanges: [toRange(172, 0, 172, 7)]
				},
				{
					to: {
						name: "CreateAtObject",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(174, 0, 174, 194),
						selectionRange: toRange(174, 0, 174, 14)
					},
					fromRanges: [toRange(174, 0, 174, 14)]
				},
				{
					to: {
						name: "PROC_SetAnubisConfig",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(176, 0, 176, 53),
						selectionRange: toRange(176, 0, 176, 20)
					},
					fromRanges: [toRange(176, 0, 176, 20)]
				},
				{
					to: {
						name: "ObjectSetTitle",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(177, 0, 177, 42),
						selectionRange: toRange(177, 0, 177, 14)
					},
					fromRanges: [toRange(177, 0, 177, 14)]
				},
				{
					to: {
						name: "SetFaction",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(178, 0, 178, 81),
						selectionRange: toRange(178, 0, 178, 10)
					},
					fromRanges: [toRange(178, 0, 178, 10)]
				},
				{
					to: {
						name: "DB_Dialogs",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(179, 0, 179, 91),
						selectionRange: toRange(179, 0, 179, 10)
					},
					fromRanges: [toRange(179, 0, 179, 10)]
				},
				{
					to: {
						name: "DB_Epilogue_Us",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(180, 0, 180, 26),
						selectionRange: toRange(180, 0, 180, 14)
					},
					fromRanges: [toRange(180, 0, 180, 14)]
				},
				{
					to: {
						name: "PROC_SetUsStatus",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(181, 0, 181, 18),
						selectionRange: toRange(181, 0, 181, 16)
					},
					fromRanges: [toRange(181, 0, 181, 16)]
				},
				{
					to: {
						name: "DB_EPI_Epilogue_EmperorVanillaLetters",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(237, 0, 237, 49),
						selectionRange: toRange(237, 0, 237, 37)
					},
					fromRanges: [toRange(237, 0, 237, 37)]
				},
				{
					to: {
						name: "DB_EPI_Epilogue_EmperorLetterRemovalFlags",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(239, 0, 239, 48),
						selectionRange: toRange(239, 0, 239, 41)
					},
					fromRanges: [toRange(239, 0, 239, 41)]
				},
				{
					to: {
						name: "DB_GlobalFlag",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(241, 0, 241, 20),
						selectionRange: toRange(241, 0, 241, 13)
					},
					fromRanges: [toRange(241, 0, 241, 13)]
				},
				{
					to: {
						name: "IsInInventoryOf",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(243, 0, 243, 84),
						selectionRange: toRange(243, 0, 243, 15)
					},
					fromRanges: [toRange(243, 0, 243, 15)]
				},
				{
					to: {
						name: "ToInventory",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(245, 0, 245, 98),
						selectionRange: toRange(245, 0, 245, 11)
					},
					fromRanges: [toRange(245, 0, 245, 11)]
				},
				{
					to: {
						name: "DB_EPI_Epilogue_EmperorVanillaLetters",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(251, 0, 251, 49),
						selectionRange: toRange(251, 0, 251, 37)
					},
					fromRanges: [toRange(251, 0, 251, 37)]
				},
				{
					to: {
						name: "QRY_EPI_Epilogue_EmperorRootLetterIsValid",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(253, 0, 253, 138),
						selectionRange: toRange(253, 0, 253, 41)
					},
					fromRanges: [toRange(253, 0, 253, 41)]
				},
				{
					to: {
						name: "IsInInventoryOf",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(255, 0, 255, 84),
						selectionRange: toRange(255, 0, 255, 15)
					},
					fromRanges: [toRange(255, 0, 255, 15)]
				},
				{
					to: {
						name: "ToInventory",
						kind: vscode.SymbolKind.Function,
						uri: epiDocUri,
						range: toRange(257, 0, 257, 98),
						selectionRange: toRange(257, 0, 257, 11)
					},
					fromRanges: [toRange(257, 0, 257, 11)]
				},
				{
					to: {
						name: "SetFlag",
						kind: vscode.SymbolKind.Function,
						uri: gloDocUri,
						range: toRange(60, 0, 60, 91),
						selectionRange: toRange(60, 0, 60, 7)
					},
					fromRanges: [toRange(60, 0, 60, 7)]
				},
				{
					to: {
						name: "DB_NOOP",
						kind: vscode.SymbolKind.Function,
						uri: gloDocUri,
						range: toRange(70, 0, 70, 10),
						selectionRange: toRange(70, 0, 70, 7)
					},
					fromRanges: [toRange(70, 0, 70, 7)]
				}
			]);
		});
	});
});

async function testPrepareCallHierarchy(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCallHierarchyItemList: vscode.CallHierarchyItem[]
) {
	await activate(docUri);

	const actualCallHierarchyItemList = (await vscode.commands.executeCommand(
		"vscode.prepareCallHierarchy",
		docUri,
		position
	)) as vscode.CallHierarchyItem[];

	assert.ok(actualCallHierarchyItemList.length === expectedCallHierarchyItemList.length);
	expectedCallHierarchyItemList.forEach((expectedItem, i) => {
		testCallHierarchyItem(actualCallHierarchyItemList[i], expectedItem);
	});
}

async function testIncomingCalls(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedIncomingCallsList: vscode.CallHierarchyIncomingCall[]
) {
	await activate(docUri);

	const items = (await vscode.commands.executeCommand(
		"vscode.prepareCallHierarchy",
		docUri,
		position
	)) as vscode.CallHierarchyItem[];

	for (const item of items) {
		const actualIncomingCalls = (await vscode.commands.executeCommand(
			"vscode.provideIncomingCalls",
			item
		)) as vscode.CallHierarchyIncomingCall[];

		assert.ok(actualIncomingCalls.length === expectedIncomingCallsList.length);
		expectedIncomingCallsList.forEach((expectedCall, i) => {
			testCallHierarchyItem(actualIncomingCalls[i].from, expectedCall.from);
			testCallRanges(actualIncomingCalls[i].fromRanges, expectedCall.fromRanges);
		});
	}
}

async function testOutgoingCalls(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedOutgoingCallsList: vscode.CallHierarchyOutgoingCall[]
) {
	await activate(docUri);

	const items = (await vscode.commands.executeCommand(
		"vscode.prepareCallHierarchy",
		docUri,
		position
	)) as vscode.CallHierarchyItem[];

	for (const item of items) {
		const actualOutgoingCalls = (await vscode.commands.executeCommand(
			"vscode.provideOutgoingCalls",
			item
		)) as vscode.CallHierarchyOutgoingCall[];

		assert.ok(actualOutgoingCalls.length === expectedOutgoingCallsList.length);
		expectedOutgoingCallsList.forEach((expectedCall, i) => {
			testCallHierarchyItem(actualOutgoingCalls[i].to, expectedCall.to);
			testCallRanges(actualOutgoingCalls[i].fromRanges, expectedCall.fromRanges);
		});
	}
}

function testCallHierarchyItem(actualCall: vscode.CallHierarchyItem, expectedCall: vscode.CallHierarchyItem) {
	assert.strictEqual(actualCall.name, expectedCall.name);
	assert.strictEqual(actualCall.kind, expectedCall.kind);
	assert.strictEqual(actualCall.uri.toString(), expectedCall.uri.toString());
	assert.deepStrictEqual(actualCall.range, expectedCall.range);
	assert.deepStrictEqual(actualCall.selectionRange, expectedCall.selectionRange);
}

function testCallRanges(actualRanges: vscode.Range[], expectedRanges: vscode.Range[]) {
	assert.ok(actualRanges.length === expectedRanges.length);
	expectedRanges.forEach((range, i) => {
		assert.deepStrictEqual(actualRanges[i], range);
	});
}
