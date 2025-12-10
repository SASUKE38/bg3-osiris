export interface ModMetaModuleShortDesc {
	folder: string;
	md5?: string;
	name: string;
	publishHandle?: string;
	uuid: string;
	version64?: string;
}

export interface ModMetaModuleInfo extends ModMetaModuleShortDesc {
	author?: string;
	characterCreationLevelName?: string;
	description?: string;
	fileSize?: string;
	lobbyLevelName?: string;
	menuLevelName?: string;
	NumPlayers?: string;
	photoBooth?: string;
	startupLevelName?: string;
	publishVersion?: ModMetaPublishVersion;
	scripts?: ModMetaScript[];
	dependencies?: ModMetaModuleShortDesc[];
}

export interface ModMetaPublishVersion {
	version64: string;
}

export interface ModMetaScript {
	uuid: string;
	parameters: ModMetaScriptParameter[];
}

export interface ModMetaScriptParameter {
	mapKey: string;
	type: string;
	value: string;
}
