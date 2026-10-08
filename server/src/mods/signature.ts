import { Location } from "vscode-languageserver";
import { SignatureNode } from "../parser/ast/nodes";

export type SignatureType = "Event" | "Call" | "Query" | "Database" | "Proc" | "SysQuery" | "SysCall" | "UserQuery";

export class Signature {
	name: string;
	type: SignatureType;
	parameters: string[];
	outParamMask?: Uint8Array;
	definitions: Location[];

	constructor(
		name: string,
		type: SignatureType,
		parameters: string[],
		definitions: Location[],
		outParamMask?: Uint8Array
	) {
		this.name = name;
		this.type = type;
		this.parameters = parameters;
		this.outParamMask = outParamMask;
		this.definitions = definitions;
	}

	mergeSignatures(signatureCollection: SignatureCollection): void {
		const storedSignature = signatureCollection.get(this)!;
		for (let i = 0; i < this.parameters.length; i++) {
			if (storedSignature.parameters[i] === "" && this.parameters[i] !== "") {
				storedSignature.parameters[i] = this.parameters[i];
			}
		}

		if (this.definitions) {
			storedSignature.definitions = storedSignature.definitions
				? [...storedSignature.definitions, ...this.definitions]
				: [...this.definitions];
		}
	}

	isOutParameter(index: number): boolean {
		return this.outParamMask ? ((this.outParamMask[index >> 3] << (index & 7)) & 0x80) === 0x80 : false;
	}

	toReadableString(includeType = true, doNumbering = false): string {
		const content: string[] = includeType
			? [getReadableSignatureType(this.type), " ", this.name, "("]
			: [this.name, "("];

		for (let i = 0; i < this.parameters.length; i++) {
			if (this.isOutParameter(i)) content.push("[out]");
			content.push(`(${this.parameters[i]})_${doNumbering ? i + 1 : ""}`);
			if (i !== this.parameters.length - 1) content.push(", ");
		}

		content.push(")");
		return content.join("");
	}
}

export class SignatureCollection {
	private readonly map: Map<string, Signature>;

	constructor();
	constructor(iterable?: Iterable<readonly [string, Signature]> | null | undefined);
	constructor(entries?: readonly (readonly [string, Signature])[] | null);
	constructor(
		iterable?: Iterable<readonly [string, Signature]> | null | undefined,
		entries?: readonly (readonly [string, Signature])[] | null
	) {
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

	getAll(signature: Signature | SignatureNode): Signature[] {
		const res: Signature[] = [];
		Array.from(this.map.keys())
			.filter((value) => {
				return value.substring(0, value.lastIndexOf("/")) === signature.name;
			})
			.forEach((value) => {
				const candidate = this.map.get(value);
				if (candidate) res.push(candidate);
			});
		return res;
	}

	getAllNamesOfType(...types: SignatureType[]): Set<string> {
		const res = new Set<string>();
		for (const entry of this.map.entries()) {
			if (types.find((value) => value === entry[1].type && !entry[0].startsWith("/")))
				res.add(entry[0].substring(0, entry[0].length - 2));
		}
		return res;
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

export function getReadableSignatureType(type: SignatureType) {
	switch (type) {
		case "Event":
			return "event";
			break;
		case "Call":
			return "call";
			break;
		case "Query":
			return "query";
			break;
		case "Database":
			return "database";
			break;
		case "Proc":
			return "proc";
			break;
		case "SysQuery":
			return "SysQuery";
			break;
		case "SysCall":
			return "SysCall";
			break;
		case "UserQuery":
			return "query";
			break;
	}
}
