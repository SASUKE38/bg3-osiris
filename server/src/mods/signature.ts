export class Signature {
	name: string;
	type: "Event" | "Call" | "Query" | "Database" | "Proc" | "SysQuery" | "SysCall" | "UserQuery";
	parameters: string[][] = [];

	constructor(
		name: string,
		parameters: string[][],
		type: "Event" | "Call" | "Query" | "Database" | "Proc" | "SysQuery" | "SysCall" | "UserQuery"
	) {
		this.name = name;
		this.parameters = parameters;
		this.type = type;
	}

	getCopy() {
		const res = new Signature(this.name, [], this.type);
		res.parameters = this.parameters.copyWithin(0, 0);
		return res;
	}
}
