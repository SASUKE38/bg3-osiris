import { CancellationToken, ProviderResult, TextDocumentContentProvider, Uri } from "vscode";

export class InheritedGoalContentProvider implements TextDocumentContentProvider {
	static readonly scheme = "bg3Osiris.InheritedGoal";

	provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
		return 'Version 1\nSubGoalCombiner SGC_AND\nINITSECTION\nDB_EPI_Epilogue_PresentNPC((CHARACTER)S_GLO_Emperor_73d49dc5-8b8b-45dc-a98c-927bb4e3169b, (DIALOGRESOURCE)EPI_Epilogue_Emperor_b81cced4-003b-bd81-b0b1-8a828412c674,(TRIGGER)S_EPI_Volo_WritePointB_68a85b14-6be1-40cc-970e-8a18cae86078, "EPI_Emperor",(FLAG)EPI_Epilogue_State_EmperorPresent_5071fdae-a335-6a74-48fe-fec1bf8b207a);';
	}
}
