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

async function getTestExecutionDetail(uri: vscode.Uri, type: vscode.FileType): Promise<ITestExecutionDetail[]> {
    let tedArray: ITestExecutionDetail[] = [];

    if (type === vscode.FileType.File) {
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
    } else {
        let glob = String(vscode.workspace.getConfiguration('karateIDE.tests').get('globFilter'));
        let karateTestFiles = await vscode.workspace.findFiles(glob).then(value => {
            return value;
        });

        let karateTestFilesFiltered = karateTestFiles.filter(karateTestFile => {
            return karateTestFile.toString().startsWith(uri.toString());
        });

        let karateTestFoldersFiltered: Array<string> = [];
        karateTestFilesFiltered.forEach(karateTestFile => {
            karateTestFoldersFiltered.push(karateTestFile.fsPath.substring(0, karateTestFile.fsPath.lastIndexOf(path.sep)));
        });

        let foundFolder = karateTestFoldersFiltered.find(folder => {
            return folder === uri.fsPath;
        });

        let classPathNormalized = '';
        if (foundFolder !== undefined) {
            classPathNormalized = uri.fsPath;
        } else {
            if (karateTestFoldersFiltered.length === 1) {
                classPathNormalized = karateTestFoldersFiltered[0];
            } else {
                let splitStrings = (a, sep = path.sep) => a.map(i => i.split(sep));
                let elAt = i => a => a[i];
                let rotate = a => a[0].map((e, i) => a.map(elAt(i)));
                let allElementsEqual = arr => arr.every(e => e === arr[0]);
                let commonPath = (input, sep = path.sep) => rotate(splitStrings(input, sep)).filter(allElementsEqual).map(elAt(0)).join(sep);

                classPathNormalized = commonPath(karateTestFoldersFiltered);
            }
        }

        let ted: ITestExecutionDetail = {
            testTag: '',
            testTitle: '',
            testLine: 0,
            testFeature: classPathNormalized,
            codelensLine: 0,
        };

        tedArray.push(ted);
    }

    return tedArray;
}

function getChildAbsolutePath(basePath: string, childPath: string): string {
    try {
        let dirents = fs.readdirSync(basePath, { withFileTypes: true });
        let result = null;

        for (let ndx = 0; ndx < dirents.length; ndx++) {
            let newBasePath = path.join(basePath, dirents[ndx].name);

            if (dirents[ndx].isDirectory()) {
                result = getChildAbsolutePath(newBasePath, childPath);
            } else {
                if (newBasePath.toLowerCase().endsWith(childPath)) {
                    result = newBasePath;
                }
            }

            if (result !== null) {
                break;
            }
        }

        return result;
    } catch (e) {
        return null;
    }
}

export { filterByTags, getFileAndRootPath, getTestExecutionDetail, getChildAbsolutePath, ITestExecutionDetail };
