import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toDocumentationMarkdownString } from "../helper";

suite("Signature Help Provider", () => {
	const gloDocUri = getDocUri("GLO_EmperorEpilogueTracking.txt");
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");

	test("Signature help for builtin with proc overloads and 0 current parameters should display the signature with the least parameters", async () => {
		const expectedDocumentation = toDocumentationMarkdownString(
			'Adds a specific spell or skill to a character.  Parameters:  _Character: character that will get the spell.  _Skill: name of the spell or skill.  _ShowNotification (optional): shows a UI notification of the spell being added to the character if they are part of the party. Set by default to 1.  _AddContainerSpell (optional): if _Skill is a container spell, all the spells part of this container will also be added to the character. Set by default to 1.\n  #### Further Information  \nSpells can be found in the stats editor under "ModName"/SpellData/"SpellType" and new ones can be created. Do not forget to add the type of spell at the start of the name, if you have the spell Scream in the Shout category you have to call it with Shout_Scream, with _ in between.  Note: Even if the call has the spell word in it, spells are not only magical actions, but other things like shove, jump, and attacking with a weapon.  \n',
			'IF\nFlagSet(_Event_UnlockVampireBite, _, _)\nTHEN\nAddSpell(_Player_Astarion, "Target_VampireBite", 0, 0);\n',
			"UseSpell",
			"RemoveSpell",
			"UseSpellAtPosition",
			"CastedSpell",
			"CastSpell",
			"CastSpellFailed",
			"LearnedSpell",
			"StartedPreviewingSpell",
			"UsingSpell",
			"UsingSpellAtPosition",
			"UsingSpellInTrigger",
			"UsingSpellOnTarget",
			"CanLearnSpell",
			"CanShowSpellForCharacter",
			"GetSpellFromSet",
			"HasSpell",
			"IsSpellActive",
			"SpellHasSpellFlag"
		);

		const expectedSignatureHelp = new vscode.SignatureHelp();
		const parameter1 = { label: "(CHARACTER)_1", documentation: undefined };
		const parameter2 = { label: "(STRING)_2", documentation: undefined };
		const parameter3 = { label: "(INTEGER)_3", documentation: undefined };
		const builtinParameter1 = { label: "(CHARACTER)_Character", documentation: undefined };
		const builtinParameter2 = { label: "(STRING)_Skill", documentation: undefined };
		const builtinParameter3 = { label: "(INTEGER)_ShowNotification", documentation: undefined };
		const builtinParameter4 = { label: "(INTEGER)_AddContainerSpells", documentation: undefined };

		expectedSignatureHelp.signatures = [
			{
				label: `proc AddSpell(${parameter1.label}, ${parameter2.label})`,
				parameters: [parameter1, parameter2]
			},
			{
				label: `proc AddSpell(${parameter1.label}, ${parameter2.label}, ${parameter3.label})`,
				parameters: [parameter1, parameter2, parameter3]
			},
			{
				label: `call AddSpell(${builtinParameter1.label}, ${builtinParameter2.label}, ${builtinParameter3.label}, ${builtinParameter4.label})`,
				documentation: expectedDocumentation,
				parameters: [builtinParameter1, builtinParameter2, builtinParameter3, builtinParameter4]
			}
		];

		await testSignatureHelp(gloDocUri, new vscode.Position(91, 9), expectedSignatureHelp);
	});

	test("Signature help for builtin with multiple signature definitions and current parameters should display the signature with the corresponding number of parameters", async () => {
		const expectedDocumentation = toDocumentationMarkdownString(
			"Use this to set _Flag on _Object.  For global flags, _Object can be set to NULL_00000000-0000-0000-0000-000000000000 or simply call SetFlag((FLAG)_Flag).  \n",
			'IF\nStatusApplied(_Player, "HAV_SELUNEOINTMENT", _, _)\nAND\nDB_PartyMembers((CHARACTER)_Player)\nTHEN\nSetFlag(_State_HasSeluneOintment, _Player);\n',
			"ClearFlag"
		);

		const expectedSignatureHelp = new vscode.SignatureHelp();
		const parameter1 = { label: "(FLAG)_1", documentation: undefined };
		const parameter2 = { label: "(GUIDSTRING)_2", documentation: undefined };
		const parameter3 = { label: "(INTEGER)_3", documentation: undefined };
		const builtinParameter1 = { label: "(FLAG)_Flag", documentation: undefined };
		const builtinParameter2 = { label: "(GUIDSTRING)_Object", documentation: undefined };
		const builtinParameter3 = { label: "(INTEGER)_DialogInstance", documentation: undefined };
		const builtinParameter4 = { label: "(INTEGER)_SendFlagSetEventIfChanged", documentation: undefined };

		expectedSignatureHelp.signatures = [
			{
				label: `proc SetFlag(${parameter1.label})`,
				parameters: [parameter1]
			},
			{
				label: `proc SetFlag(${parameter1.label}, ${parameter2.label})`,
				parameters: [parameter1, parameter2]
			},
			{
				label: `proc SetFlag(${parameter1.label}, ${parameter2.label}, ${parameter3.label})`,
				parameters: [parameter1, parameter2, parameter3]
			},
			{
				label: `call SetFlag(${builtinParameter1.label}, ${builtinParameter2.label}, ${builtinParameter3.label}, ${builtinParameter4.label})`,
				documentation: expectedDocumentation,
				parameters: [builtinParameter1, builtinParameter2, builtinParameter3, builtinParameter4]
			}
		];
		expectedSignatureHelp.activeSignature = 1;
		expectedSignatureHelp.activeParameter = 1;

		await testSignatureHelp(gloDocUri, new vscode.Position(33, 90), expectedSignatureHelp);
	});

	test("Signature help triggered on the signature's name should display nothing", async () => {
		await testSignatureHelp(gloDocUri, new vscode.Position(58, 5), null);
	});

	test("Signature help for signature with one signature definition should display the sole signature definition", async () => {
		const expectedSignatureHelp = new vscode.SignatureHelp();
		expectedSignatureHelp.signatures = [
			{
				label: "query QRY_END_GameFinale_CharacterCannotFinale((CHARACTER)_1)",
				parameters: [{ label: "(CHARACTER)_1", documentation: undefined }]
			}
		];

		await testSignatureHelp(endDocUri, new vscode.Position(75, 63), expectedSignatureHelp);
	});

	test("Signature help for signature with filled parameters and cursor on one of them should display with that parameter as active", async () => {
		const expectedDocumentation = toDocumentationMarkdownString(
			"Makes a character use a spell or skill on a target.  Parameters:  _Character: caster of the spell.  _SpellID: name of the spell including its spell category (Category_SpellName).  _Target: target to which the spell aims. Can also be the caster.  _Target2 (optional): any additional targets. If not specified it will be NULL by default.  _WithoutMove (optional): set to 1 for the caster to not move if needed to be in range. Set to 0 by default.\n  #### Further Information  \nCasting a spell from Osiris will always ignore any pre-conditions, like if the character does not have access to it by default or if they don’t have any resources to cast it.  \n",
			'IF\nStatusRemoved((CHARACTER)_Cultist,"SNIPING_AIMING",_,_)\nAND\nQRY_PartyMemberIsInRitualSight()\nTHEN\nUseSpell(_Cultist,"PowerWordKill_Ritual", _Cultist);\n',
			"AddSpell",
			"RemoveSpell",
			"UseSpellAtPosition",
			"CastedSpell",
			"CastSpell",
			"CastSpellFailed",
			"LearnedSpell",
			"StartedPreviewingSpell",
			"UsingSpell",
			"UsingSpellAtPosition",
			"UsingSpellInTrigger",
			"UsingSpellOnTarget",
			"CanLearnSpell",
			"CanShowSpellForCharacter",
			"GetSpellFromSet",
			"HasSpell",
			"IsSpellActive",
			"SpellHasSpellFlag"
		);

		const expectedSignatureHelp = new vscode.SignatureHelp();
		const parameter1 = { label: "(GUIDSTRING)_1", documentation: undefined };
		const parameter2 = { label: "(STRING)_2", documentation: undefined };
		const parameter3 = { label: "(GUIDSTRING)_3", documentation: undefined };
		const parameter4 = { label: "(GUIDSTRING)_4", documentation: undefined };
		const builtinParameter1 = { label: "(GUIDSTRING)_Caster", documentation: undefined };
		const builtinParameter2 = { label: "(STRING)_SpellID", documentation: undefined };
		const builtinParameter3 = { label: "(GUIDSTRING)_Target", documentation: undefined };
		const builtinParameter4 = { label: "(GUIDSTRING)_Target2", documentation: undefined };
		const builtinParameter5 = { label: "(INTEGER)_WithoutMove", documentation: undefined };

		expectedSignatureHelp.signatures = [
			{
				label: `proc UseSpell(${parameter1.label}, ${parameter2.label}, ${parameter3.label})`,
				parameters: [parameter1, parameter2, parameter3]
			},
			{
				label: `proc UseSpell(${parameter1.label}, ${parameter2.label}, ${parameter3.label}, ${parameter4.label})`,
				parameters: [parameter1, parameter2, parameter3, parameter4]
			},
			{
				label: `call UseSpell(${builtinParameter1.label}, ${builtinParameter2.label}, ${builtinParameter3.label}, ${builtinParameter4.label}, ${builtinParameter5.label})`,
				documentation: expectedDocumentation,
				parameters: [
					builtinParameter1,
					builtinParameter2,
					builtinParameter3,
					builtinParameter4,
					builtinParameter5
				]
			}
		];
		expectedSignatureHelp.activeSignature = 2;
		expectedSignatureHelp.activeParameter = 3;

		await testSignatureHelp(gloDocUri, new vscode.Position(98, 46), expectedSignatureHelp);
	});

	test("Signature help for signature with filled parameters and cursor on next space should display with the next parameter to be filled as active", async () => {
		const expectedSignatureHelp = new vscode.SignatureHelp();
		const parameter1 = { label: "(CHARACTER)_1", documentation: undefined };
		const parameter2 = { label: "(CHARACTER)_2", documentation: undefined };

		expectedSignatureHelp.signatures = [
			{
				label: `proc PROC_END_GameFinale_EndRelationship(${parameter1.label})`,
				parameters: [parameter1]
			},
			{
				label: `proc PROC_END_GameFinale_EndRelationship(${parameter1.label}, ${parameter2.label})`,
				parameters: [parameter1, parameter2]
			}
		];
		expectedSignatureHelp.activeParameter = 1;
		expectedSignatureHelp.activeSignature = 1;

		await testSignatureHelp(endDocUri, new vscode.Position(28, 56), expectedSignatureHelp);
	});

	test("Signature help triggered outside of a signature should do nothing", async () => {
		await testSignatureHelp(gloDocUri, new vscode.Position(57, 2), null);
	});
});

async function testSignatureHelp(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedSignatureHelp: vscode.SignatureHelp | null
) {
	await activate(docUri);

	const actualSignatureHelp = (await vscode.commands.executeCommand(
		"vscode.executeSignatureHelpProvider",
		docUri,
		position
	)) as vscode.SignatureHelp;

	if (!expectedSignatureHelp) {
		assert.ok(!actualSignatureHelp);
	} else {
		assert.strictEqual(actualSignatureHelp.activeParameter, expectedSignatureHelp.activeParameter);
		assert.strictEqual(actualSignatureHelp.activeSignature, expectedSignatureHelp.activeSignature);
		assert.ok(expectedSignatureHelp.signatures.length === actualSignatureHelp.signatures.length);
		expectedSignatureHelp.signatures.forEach((expectedSignature, i) => {
			assert.strictEqual(actualSignatureHelp.signatures[i].label, expectedSignature.label);
			assert.strictEqual(
				(actualSignatureHelp.signatures[i].documentation as vscode.MarkdownString)?.value,
				(expectedSignature.documentation as vscode.MarkdownString)?.value
			);
			assert.strictEqual(actualSignatureHelp.signatures[i].activeParameter, expectedSignature.activeParameter);
			assert.deepStrictEqual(actualSignatureHelp.signatures[i].parameters, expectedSignature.parameters);
		});
	}
}
