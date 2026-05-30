import { Location } from "vscode-languageserver";

export class Signature {
	name: string;
	type: "proc" | "query" | "database" | "builtin";
	definitions: Location[] = [];
	calls: Location[] = [];
	reads: Location[] = [];
	writes: Location[] = [];
	parameters: string[][] = [];

	constructor(name: string, type: "proc" | "query" | "database" | "builtin") {
		this.name = name;
		this.type = type;
	}

	getCopy() {
		const res = new Signature(this.name, this.type);
		res.definitions = this.definitions.copyWithin(0, 0);
		res.calls = this.calls.copyWithin(0, 0);
		res.reads = this.reads.copyWithin(0, 0);
		res.writes = this.writes.copyWithin(0, 0);
		res.parameters = this.parameters.copyWithin(0, 0);
		return res;
	}
}
