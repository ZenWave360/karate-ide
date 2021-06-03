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
        if (!completionToken.includes('read(')) {
            return undefined;
        }
        const regex = /read\(['"](.*)/gm;
        const groups = regex.exec(completionToken);
        const filePrefix = groups && groups.length === 2 ? groups[1] : '';
        console.log('completionToken', completionToken, filePrefix);
        return filesManager.getAutoCompleteEntries(document.uri, filePrefix).map(item => {
            item.insertText = item.label.replace(filePrefix, '');
            return item;
        });
    }
}
