import { SignatureNode } from "../parser/ast/nodes";

export class Signature {
	name: string;
	type: "Event" | "Call" | "Query" | "Database" | "Proc" | "SysQuery" | "SysCall" | "UserQuery";
	parameters: string[] = [];

	constructor(
		name: string,
		parameters: string[],
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

export class SignatureCollection {
	private readonly map: Map<string, Signature>;

	constructor()
	constructor(iterable?: Iterable<readonly [string, Signature]> | null | undefined);
	constructor(entries?: readonly (readonly [string, Signature])[] | null);
	constructor(iterable?: Iterable<readonly [string, Signature]> | null | undefined, entries?: readonly (readonly [string, Signature])[] | null) {
		if (entries) this.map = new Map<string, Signature>(entries);
		else if (iterable) this.map = new Map<string, Signature>(iterable);
		else this.map = new Map<string, Signature>();
	}

	private getKey(signature: Signature | SignatureNode): string {
		return `${signature.name}/${signature.parameters.length}`;
	}

	get(signature: Signature | SignatureNode): Signature | undefined {
		return this.map.get(this.getKey(signature));
	}

	set(signature: Signature) {
		this.map.set(this.getKey(signature), signature);
	}

	has(signature: Signature | SignatureNode): boolean {
		return this.map.has(this.getKey(signature));
	}

	entries(): MapIterator<[string, Signature]> {
		return this.map.entries();
	}

	clear() {
		this.map.clear();
	}
}