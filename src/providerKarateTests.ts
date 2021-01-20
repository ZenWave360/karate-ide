import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as minimatch from 'minimatch';
import { LocalStorageService } from './commands/LocalStorageService';
import { FileStat } from './providerBuildReports';
import { filterByTags, getTestExecutionDetail, ITestExecutionDetail } from './helper';

function normalizeNFC(items: string): string;
function normalizeNFC(items: string[]): string[];
function normalizeNFC(items: string | string[]): string | string[] {
    if (process.platform !== 'darwin') {
        return items;
    }

    if (Array.isArray(items)) {
        return items.map(item => item.normalize('NFC'));
    }

    return items.normalize('NFC');
}

export interface IEntry {
    uri: any;
    type: vscode.FileType;
    command?: vscode.Command;
    title: string;
    feature: { path: string; line?: number };
}

export class ProviderKarateTests implements vscode.TreeDataProvider<IEntry> {
    private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor() {
        console.log('ProviderKarateTests');
        // this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    }

    public refresh(): any {
        this._onDidChangeTreeData.fire();
    }

    get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
        return this._onDidChangeFile.event;
    }

    async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const children = fs.readdirSync(uri.fsPath);

        const result: [string, vscode.FileType][] = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const stat = new FileStat(await fs.statSync(path.join(uri.fsPath, child)));
            result.push([child, stat.type]);
        }

        return Promise.resolve(result);
    }

    async switchKarateEnv() {
        let karateEnv = String(vscode.workspace.getConfiguration('karateRunner.karateCli').get('karateEnv'));
        karateEnv = await vscode.window.showInputBox({ prompt: 'Karate Env', value: karateEnv });
        if (karateEnv) {
            await vscode.workspace.getConfiguration().update('karateRunner.karateCli.karateEnv', karateEnv);
        }
    }

    async configureTestsFocus() {
        let focus = LocalStorageService.instance.getValue<string>('testView.focus');
        focus = await vscode.window.showInputBox({ prompt: 'Focus', value: focus, placeHolder: '**/** -t ~@ignore' });
        LocalStorageService.instance.setValue('testView.focus', focus);
    }

    async getChildren(element?: IEntry): Promise<IEntry[]> {
        let workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
        let [focus, t, tags] = LocalStorageService.instance.getValue<string>('testView.focus', '').trim().split(/\s+/);
        let glob = String(vscode.workspace.getConfiguration('karateRunner.tests').get('toTarget'));

        let karateTestFiles = (await vscode.workspace.findFiles(glob))
            .filter(f => true || minimatch(f.fsPath, focus, { matchBase: true }))
            .sort((a, b) => a.fsPath.localeCompare(b.fsPath));

        if (element) {
            if (element.type === vscode.FileType.File && element.uri.fsPath.endsWith('.feature')) {
                let tedArray: ITestExecutionDetail[] = await getTestExecutionDetail(element.uri, vscode.FileType.File);
                return tedArray
                    .map(ted => {
                        return {
                            tags: ted.testTag,
                            uri: ted.testTitle,
                            type: vscode.FileType.Unknown,
                            title: ted.testTitle,
                            feature: { path: element.uri.fsPath, line: ted.debugLine },
                            command: {
                                command: 'karateRunner.tests.open',
                                title: ted.codelensRunTitle,
                                arguments: [element.uri, ted.debugLine],
                            },
                        };
                    })
                    .filter(t => filterByTags(t.tags, tags));
            }

            let displayType = String(vscode.workspace.getConfiguration('karateRunner.tests').get('activityBarDisplayType'));

            if (displayType === 'Shallow') {
                let karateTestFilesFiltered = karateTestFiles.filter(karateTestFile => {
                    return karateTestFile.toString().startsWith(element.uri.toString());
                });

                return karateTestFilesFiltered.map(karateTestFile => ({
                    uri: karateTestFile,
                    type: vscode.FileType.File,
                    title: karateTestFile.fsPath,
                    feature: { path: karateTestFile.fsPath },
                }));
            } else {
                let children = await this._readDirectory(element.uri);

                let childrenFiltered = children.filter(child => {
                    let childUri = vscode.Uri.file(path.join(element.uri.fsPath, child[0]));

                    let found = karateTestFiles.find(file => {
                        return file.toString().startsWith(childUri.toString());
                    });

                    return found !== undefined;
                });

                return childrenFiltered.map(([name, type]) => ({
                    uri: vscode.Uri.file(path.join(element.uri.fsPath, name)),
                    type: type,
                    title: vscode.Uri.file(path.join(element.uri.fsPath, name)).fsPath,
                    feature: { path: vscode.Uri.file(path.join(element.uri.fsPath, name)).fsPath },
                    command:
                        type === vscode.FileType.File
                            ? {
                                  command: 'karateRunner.tests.open',
                                  title: `karateRunner.tests.open`,
                                  arguments: [vscode.Uri.file(path.join(element.uri.fsPath, name))],
                              }
                            : {
                                  command: 'karateRunner.tests.runAll',
                                  title: 'karateRunner.tests.runAll',
                              },
                }));
            }
        }

        if (workspaceFolder) {
            let children = await this._readDirectory(workspaceFolder.uri);

            let childrenFiltered = children.filter(child => {
                let childUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, child[0]));

                let found = karateTestFiles.find(file => {
                    return file.toString().startsWith(childUri.toString());
                });

                return found !== undefined;
            });

            if (childrenFiltered.length <= 0) {
                return [{ uri: 'No tests found...', type: vscode.FileType.Unknown, title: 'No tests found...', feature: null }];
            }

            childrenFiltered.sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }

                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });

            return childrenFiltered.map(([name, type]) => ({
                uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)),
                type: type,
                title: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)).fsPath,
                feature: null,
            }));
        }

        return [{ uri: 'No tests found...', type: vscode.FileType.Unknown, title: 'No tests found...', feature: null }];
    }

    getTreeItem(element: IEntry): vscode.TreeItem {
        let collapsibleState: vscode.TreeItemCollapsibleState;
        if (element.type === vscode.FileType.Directory || (element.type === vscode.FileType.File && element.uri.fsPath.endsWith('.feature'))) {
            collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        } else {
            collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        const treeItem = new vscode.TreeItem(element.uri, collapsibleState);
        treeItem.command = element.command;

        if (collapsibleState === vscode.TreeItemCollapsibleState.None && element.type !== vscode.FileType.File) {
            treeItem.iconPath = {
                light: path.join(__dirname, '..', '..', 'resources', 'light', 'karate-test.svg'),
                dark: path.join(__dirname, '..', '..', 'resources', 'dark', 'karate-test.svg'),
            };
            treeItem.contextValue = 'test';
        } else if (element.type === vscode.FileType.File && element.uri.fsPath.endsWith('.feature')) {
            treeItem.iconPath = {
                light: path.join(__dirname, '..', '..', 'resources', 'light', 'karate-test.svg'),
                dark: path.join(__dirname, '..', '..', 'resources', 'dark', 'karate-test.svg'),
            };
            treeItem.contextValue = 'testFile';
        } else if (element.type === vscode.FileType.File) {
            treeItem.contextValue = 'file';
        } else if (element.type === vscode.FileType.Directory) {
            treeItem.contextValue = 'testDirectory';
        }

        return treeItem;
    }
}

export default ProviderKarateTests;
