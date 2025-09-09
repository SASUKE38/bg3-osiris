import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();

const builtinProcs = new Set<string>();
const builtinQrys = new Set<string>();
const builtinEvents = new Set<string>();

builtinEvents.add("CombatStarted");
builtinProcs.add("GetFlag");
builtinQrys.add("IsTagged");

export const legend = (function() {
    const tokenTypesLegend = [
        'proc', 'event', 'qry', 'function'
    ];
    tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
    return new vscode.SemanticTokensLegend(tokenTypesLegend, []);
})();

interface ParsedToken {
    line: number,
    startCharacter: number,
    length: number,
    tokenType: string,
    tokenModifiers: string[];
}

export class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        const tokens = this.parseText(document.getText());
        const builder = new vscode.SemanticTokensBuilder();
        tokens.forEach(token => {
            builder.push(token.line, token.startCharacter, token.length, this.encodeTokenType(token.tokenType));
        });
        return builder.build();
    }

    private parseText(text: string): ParsedToken[] {
        const res: ParsedToken[] = [];
        const lines = text.split(/\r\n|\r|\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            this.parseBuiltins(i, line, res);
        }
        return res;
    }

    private parseBuiltins(line: number, content: string, res: ParsedToken[]) {
        const matches = content.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\(/g);
        for (const match of matches) {
            const name = match[0].substring(0, match[0].length - 1);
            if (!name.startsWith("PROC_") && !name.startsWith("QRY_") && !name.startsWith("DB_")) {
                let type = "function";
                if (builtinEvents.has(name)) type = "event";
                else if (builtinQrys.has(name)) type = "qry";
                else if (builtinProcs.has(name)) type = "proc";
                
                res.push({
                    line: line,
                    startCharacter: match.index,
                    length: match[0].length - 1,
                    tokenType: type,
                    tokenModifiers: []
                });
            }
        }
    }

    private encodeTokenType(tokenType: string): number {
        if (tokenTypes.has(tokenType)) {
            return tokenTypes.get(tokenType)!;
        }
        return 0;
    }
}