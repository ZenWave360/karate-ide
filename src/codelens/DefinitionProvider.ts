import { filesManager } from '@/fs/FilesManager';
import * as vscode from 'vscode';

export default class DefinitionProvider implements vscode.DefinitionProvider {
    constructor() {}

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Definition {
        // console.log('provideDefinition', document.lineAt(position.line), position.character);
        const text = document.lineAt(position.line).text;
        const regex = /["']([^"']*)["']/g;
        let m;
        while ((m = regex.exec(text)) !== null) {
            const token = m[1];
            const start = m.index + 1,
                end = m.index + token.length;
            if (position.character >= start && position.character <= end) {
                return filesManager.getPeekDefinitions(document, token);
            }
        }
    }
}
