import { Location } from "vscode-languageserver";
import { SignatureNode } from "../parser/ast/nodes";
import { rangeEquals } from "../utils/positionUtils";

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

	merge(otherSignature: Signature) {
		for (let i = 0; i < this.parameters.length; i++) {
			if (otherSignature.parameters[i] === "" && this.parameters[i] !== "") {
				otherSignature.parameters[i] = this.parameters[i];
			}
		}

		if (this.definitions) {
			for (const definition of this.definitions) {
				if (
					!otherSignature.definitions.find((value) => {
						return value.uri === definition.uri && rangeEquals(value.range, definition.range);
					})
				) {
					otherSignature.definitions.push(definition);
				}
			}
		}
	}

	combine(otherSignature: Signature): Signature {
		const parameters: string[] = [...this.parameters];

		for (let i = 0; i < this.parameters.length; i++) {
			if (this.parameters[i] !== "" && parameters[i] === "") {
				parameters[i] = this.parameters[i];
				continue;
			}
			if (otherSignature.parameters[i] !== "" && parameters[i] === "") {
				parameters[i] = otherSignature.parameters[i];
				continue;
			}
		}

		const res = new Signature(this.name, this.type, parameters, [], this.outParamMask);
		res.definitions = [...res.definitions, ...otherSignature.definitions, ...this.definitions];

		return res;
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

	isBuiltin() {
		return (
			this.type === "SysCall" ||
			this.type === "Query" ||
			this.type === "Event" ||
			this.type === "Call" ||
			this.type === "SysQuery"
		);
	}

	doesOverloadBuiltin(signatures: SignatureCollection) {
		const allItems = signatures.getAll(this);
		return allItems.find((value) => value.isBuiltin());
	}
}

export class SignatureCollection {
	private readonly map = new Map<string, Signature>();

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

	getHierarchicalType(signature: Signature | SignatureNode): SignatureType {
		const signatures = this.getAll(signature);
		for (const version of signatures) {
			if (version.isBuiltin()) return version.type;
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return this.has(signature) ? this.get(signature)!.type : "Call";
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

	merge(collection: SignatureCollection) {
		for (const signature of collection.entries()) {
			this.mergeSignature(signature[1], signature[0]);
		}
	}

	mergeSignature(signature: Signature, signatureKey?: string) {
		const key = signatureKey ? signatureKey : this.getKey(signature);
		if (!this.map.has(key)) {
			this.map.set(key, signature);
		} else {
			const oldSignature = this.map.get(key);
			this.map.set(key, oldSignature!.combine(signature));
		}
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
