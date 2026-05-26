import { Location } from "vscode-languageserver";

export class Signature {
	name: string;
	isDatabase: boolean;
	hasDefinition = false;
	locations: Location[] = [];
	reads: Location[] = [];
	writes: Location[] = [];

	constructor(name: string, isDatabase = false) {
		this.name = name;
		this.isDatabase = isDatabase;
	}
}
