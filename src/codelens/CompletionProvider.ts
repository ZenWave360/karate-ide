import { filesManager } from '@/fs/FilesManager';
import * as vscode from 'vscode';
import path = require('path');
import fs = require('fs');

export class CompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        let completionToken = document.lineAt(position).text.substr(0, position.character);
        // if (!completionToken.endsWith("read('") && !completionToken.endsWith('read("')) {
        //     return undefined;
        // }

        return filesManager.getAutoCompleteEntries(document.uri, completionToken);
    }
}
