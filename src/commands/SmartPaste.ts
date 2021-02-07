import * as vscode from 'vscode';
import * as parse from 'parse-curl';

export async function smartPaste() {
    const curlIgnores = ['accept-', 'upgrade-', 'user-', 'connection', 'referer', 'sec-', 'origin', 'host', 'content-length'];

    let curlIgnoreHeader = (header: string) => {
        for (let ignore of curlIgnores) {
            if (header.toLowerCase().startsWith(ignore)) {
                return true;
            }
        }

        return false;
    };

    let convertCurl = (raw: string) => {
        let steps: Array<string> = [];
        raw = raw.replace('--data-binary', '--data');
        const curl: object = parse(raw);
        steps.push("* url '" + curl['url'] + "'");
        const headers: object = curl['header'] || {};

        for (let key of Object.keys(headers)) {
            if (curlIgnoreHeader(key)) {
                continue;
            }

            let val: string = headers[key];
            steps.push('* header ' + key + " = '" + val + "'");
        }

        let method: string = curl['method'];
        let body = curl['body'];

        if (!body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            body = "''";
        }

        if (body) {
            steps.push('* request ' + body);
        }

        steps.push('* method ' + method.toLowerCase());
        return steps.join('\n');
    };

    let editor = vscode.window.activeTextEditor;
    let start = editor.selection.start;

    vscode.commands.executeCommand('editor.action.clipboardPasteAction').then(() => {
        let end = editor.selection.end;
        let selection = new vscode.Selection(start.line, start.character, end.line, end.character);
        let selectedText = editor.document.getText(selection).trim();

        if (selectedText.startsWith('curl')) {
            editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(selection, convertCurl(selectedText) + '\n');
                editor.revealRange(new vscode.Range(start, start));
            });
        }
    });
}
