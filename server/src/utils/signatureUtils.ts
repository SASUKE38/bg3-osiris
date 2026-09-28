import { Signature, SignatureCollection } from "../mods/signature";

export function mergeSignature(signature: Signature, signatureCollection: SignatureCollection) {
	const storedSignature = signatureCollection.get(signature)!;
	for (let i = 0; i < signature.parameters.length; i++) {
		if (storedSignature.parameters[i] === "" && signature.parameters[i] !== "") {
			storedSignature.parameters[i] = signature.parameters[i];
		}
	}

	if (signature.definitions) {
		storedSignature.definitions = storedSignature.definitions
			? [...storedSignature.definitions, ...signature.definitions]
			: [...signature.definitions];
	}
}

export function isOutParameter(signature: Signature, index: number) {
	return signature.outParamMask ? ((signature.outParamMask[index >> 3] << (index & 7)) & 0x80) === 0x80 : false;
}
