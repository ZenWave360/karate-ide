import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

class ITestExecutionDetail {
    testTag: string;
    testTitle: string;
    testFeature: string;
    testLine: number;
    codelensLine: number;
}

function filterByTags(testTagString: string, filterTagString: string) {
    // splits by whole word, or "quoted word"
    let testTags = (testTagString || '').replace(/,/g, ' ').match(/(~|@|\w)+/g) || [];
    let andTags = (filterTagString || '').replace(/,/g, ' ').match(/(~|@|\w)+|"[^"]+"/g) || [];
    return andTags.reduce((and, tag) => {
        const orTags = tag.replace(/\"/g, '').match(/\S+/g);
        const test = orTags.reduce((or, tag) => {
            const negate = tag.startsWith('~');
            const test = testTags.includes(tag.replace('~', ''));
            return or || (negate ? !test || testTags.length === 0 : test);
        }, false);
        return and && test;
    }, true);
}

function getFileAndRootPath(uri): { file: string; root: string } {
    let rootFolderUri = vscode.workspace.getWorkspaceFolder(uri);
    let rootModuleMarkerFile: string = vscode.workspace.getConfiguration('karateIDE.multimodule').get('rootModuleMarkerFile');

    let rootPath = rootFolderUri.uri.fsPath;
    let filePath = uri.fsPath.replace(rootPath + path.sep, '');
    let filePathArray = filePath.split(path.sep);

    if (rootModuleMarkerFile && rootModuleMarkerFile.trim().length > 0) {
        while (filePathArray.pop()) {
            let runFileTestPath = filePathArray.join(path.sep);
            if (fs.existsSync(path.join(rootPath, runFileTestPath, rootModuleMarkerFile))) {
                rootPath = path.join(rootPath, runFileTestPath);
                filePath = uri.fsPath.replace(rootPath + path.sep, '');
                break;
            }
        }
    }

    return { root: rootPath, file: filePath };
}

async function getTestExecutionDetail(uri: vscode.Uri): Promise<ITestExecutionDetail[]> {
    let tedArray: ITestExecutionDetail[] = [];

    let document = await vscode.workspace.openTextDocument(uri);

    let lineTestRegExp = new RegExp('^\\s*(Feature|Scenario|Scenario Outline):.*$');
    let lineTagRegExp = new RegExp('^\\s*@.+$');
    for (let line = 0; line < document.lineCount; line++) {
        let ted: ITestExecutionDetail = new ITestExecutionDetail();
        ted.testFeature = uri.fsPath;

        let lineText = document.lineAt(line).text;
        let lineTestMatch = lineText.match(lineTestRegExp);
        if (lineTestMatch !== null && lineTestMatch.index !== undefined) {
            ted.testTitle = lineText.trim();
            ted.codelensLine = line;

            if (line > 0) {
                let lineLastText = document.lineAt(line - 1).text;
                let lineTagMatch = lineLastText.match(lineTagRegExp);
                if (lineTagMatch !== null && lineTagMatch.index !== undefined) {
                    ted.testTag = lineLastText.trim();
                    ted.codelensLine--;
                } else {
                    ted.testTag = '';
                }
            }
            let lineScenarioRegExp = new RegExp('^\\s*(Scenario|Scenario Outline):(.*)$');
            let lineScenarioMatch = lineText.match(lineScenarioRegExp);
            if (lineScenarioMatch !== null && lineScenarioMatch.index !== undefined) {
                ted.testLine = line + 1;
            } else {
                ted.testLine = 0;
            }

            tedArray.push(ted);
        }
    }

    return tedArray;
}

export { filterByTags, getFileAndRootPath };
