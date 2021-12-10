import * as vscode from 'vscode';
import * as path from 'path';
import * as yml from 'js-yaml';
import * as parseCurl from 'parse-curl';

export async function smartPaste() {
    let editor = vscode.window.activeTextEditor;
    let start = editor.selection.start;
    let end = editor.selection.end;
    let selectedText = editor.document.getText(editor.selection);
    let currentLineText = editor.document.lineAt(start.line).text;
    let clipboad = await vscode.env.clipboard.readText();

    if (editor.document.languageId !== 'karate') {
        return vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    }

    if (clipboad.startsWith('curl')) {
        return replace(editor, convertCurl(clipboad), editor.selection);
    } else if (currentLineText.trim().startsWith('|')) {
        const json = parse(clipboad);
        if (typeof json === 'object') {
            let currentToken = getWordAtPosition(currentLineText, start.character, [' ', '|', '\t', "'", '"']);
            if (currentToken.endsWith('.json') || currentToken.endsWith('.yml')) {
                const baseDir = path.dirname(editor.document.fileName);
                const file = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(baseDir), saveLabel: 'Save as' });
                if (file) {
                    const token = path.relative(baseDir, file.fsPath).replace(/\\/g, '/');
                    const newLineText = currentLineText.replace(currentToken, token);
                    if (file.fsPath.endsWith('.json')) {
                        vscode.workspace.fs.writeFile(file, Buffer.from(JSON.stringify(json, null, 2)));
                    }
                    if (file.fsPath.endsWith('.yml')) {
                        vscode.workspace.fs.writeFile(file, Buffer.from(`${yml.dump(json)}`));
                    }
                    return insertNewLine(editor, newLineText, start.line);
                }
            } else if (Array.isArray(json)) {
                return insertNewLine(editor, `\t | ${json.join(' | ')} |`, start.line);
            } else {
                // find headers line
                let headersLine = start.line;
                let headers = editor.document.lineAt(headersLine).text.trim();
                while (
                    editor.document
                        .lineAt(--headersLine)
                        .text.trim()
                        .startsWith('|')
                ) {
                    headers = editor.document.lineAt(headersLine).text.trim();
                }
                let oneCellMatched = true; // TODO
                const newLineArray = headers.split('|').map(cell => json[cell.trim()] || cell.replace(/\./g, ' '));
                if (oneCellMatched) {
                    return insertNewLine(editor, `\t${newLineArray.join(' | ')}`, start.line);
                }
            }
        }
    }

    vscode.commands.executeCommand('editor.action.clipboardPasteAction');
}

function parse(text: string) {
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            return yml.load(text);
        } catch (e) {
            return text;
        }
    }
}

function getWordAtPosition(text: string, position: number, separator: string[] = [' ']) {
    let wordAtPosition = '';
    let start = position;
    let end = position;

    while (start > 0 && !separator.includes(text.charAt(start - 1))) {
        start--;
    }

    while (end < text.length && !separator.includes(text.charAt(end))) {
        end++;
    }

    wordAtPosition = text.substring(start, end);
    return wordAtPosition;
}

const curlIgnores = ['accept-', 'upgrade-', 'user-', 'connection', 'referer', 'sec-', 'origin', 'host', 'content-length'];

const convertCurl = (raw: string) => {
    raw = raw.replace('--data-binary', '--data').replace('--data-raw', '--data');
    const curl: object = parseCurl(raw);
    const headers: object = curl['header'] || {};

    let steps: Array<string> = [];
    steps.push("Given url '" + curl['url'] + "'");

    for (let key of Object.keys(headers)) {
        for (let ignore of curlIgnores) {
            if (key.toLowerCase().startsWith(ignore)) {
                continue;
            }
        }

        steps.push('And header ' + key + " = '" + headers[key] + "'");
    }

    let method: string = curl['method'];
    let body = curl['body'];

    if (!body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        body = "''";
    }
    if (body && body.includes('\n')) {
        body = '\n"""\n' + body + '\n"""\n';
    }

    if (body) {
        steps.push('And request ' + body);
    }

    steps.push('When method ' + method.toLowerCase());
    return steps.join('\n') + '\n';
};

function insertNewLine(editor: vscode.TextEditor, text: string, line: number) {
    editor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.insert(new vscode.Position(line + 1, 0), text + '\n');
    });
}

function replace(editor: vscode.TextEditor, text: string, selection: vscode.Selection) {
    editor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.replace(selection, text);
        editor.revealRange(new vscode.Range(selection.start, selection.start));
    });
}