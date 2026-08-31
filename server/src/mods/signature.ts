export enum SignatureType {
	Unknown,
	Proc,
	Query,
	Database,
	BuiltinCall,
	BuiltinQuery,
	BuiltinEvent
}

export function getReadableSignatureType(type: SignatureType) {
	switch (type) {
		case SignatureType.Unknown:
			return "unknown";
			break;
		case SignatureType.Proc:
			return "PROC";
			break;
		case SignatureType.Query:
			return "user-defined query";
			break;
		case SignatureType.Database:
			return "database";
			break;
		case SignatureType.BuiltinCall:
			return "call";
			break;
		case SignatureType.BuiltinQuery:
			return "query";
			break;
		case SignatureType.BuiltinEvent:
			return "event";
			break;
	}
}

export class Signature {
	name: string;
	type: SignatureType;
	isDefined = false;
	isCalled = false;
	isRead = false;
	isWritten = false;
	parameters: string[][] = [];

	constructor(name: string, type: SignatureType) {
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
