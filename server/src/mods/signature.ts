import { Location } from "vscode-languageserver";

export class Signature {
	name: string;
	type: "proc" | "query" | "database" | "builtin";
	isDefined = false;
	isCalled = false;
	isRead = false;
	isWritten = false;
	parameters: string[][] = [];

	constructor(name: string, type: "proc" | "query" | "database" | "builtin") {
		this.name = name;
		this.type = type;
	}

	getCopy() {
		const res = new Signature(this.name, this.type);
		res.isDefined = this.isDefined;
		res.isCalled = this.isCalled;
		res.isRead = this.isRead;
		res.isWritten = this.isWritten;
		res.parameters = this.parameters.copyWithin(0, 0);
		return res;
	}
}
