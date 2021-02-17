import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as minimatch from 'minimatch';
import { LocalStorageService } from './commands/LocalStorageService';
import { filterByTags, getTestExecutionDetail, ITestExecutionDetail } from './helper';
import Icons from './Icons';

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

export class KarateTestTreeEntry {
    uri: vscode.Uri;
    type: vscode.FileType;
    command?: vscode.Command;
    title: string;
    tooltip?: string;
    feature: { path: string; line?: number };
    tags: any;
    constructor(partial: Partial<KarateTestTreeEntry>) {
        Object.assign(this, partial);
    }
}

export class ProviderKarateTests implements vscode.TreeDataProvider<KarateTestTreeEntry> {
    private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
    karateTestFiles: vscode.Uri[];

    constructor() {
        console.log('ProviderKarateTests');
        // this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    }

    private async getKarateFiles(focus: string) {
        let glob = String(vscode.workspace.getConfiguration('karateIDE.tests').get('toTarget'));
        return (this.karateTestFiles =
            this.karateTestFiles ||
            (await vscode.workspace.findFiles(glob)).filter(f => !focus || (focus.length > 0 && minimatch(f.path, focus, { matchBase: true }))));
    }

    public refresh(): any {
        this.karateTestFiles = null;
        this._onDidChangeTreeData.fire(null);
    }

    get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
        return this._onDidChangeFile.event;
    }

    async switchKarateEnv() {
        let karateEnv = String(vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv'));
        karateEnv = await vscode.window.showInputBox({ prompt: 'Karate Env', value: karateEnv });
        if (karateEnv !== undefined) {
            await vscode.workspace.getConfiguration().update('karateIDE.karateCli.karateEnv', karateEnv);
        }
    }

    async configureTestsFocus() {
        let focus = LocalStorageService.instance.getValue<string>('karateIDE.testView.focus');
        focus = await vscode.window.showInputBox({ prompt: 'Focus', value: focus, placeHolder: '**/** -t ~@ignore' });
        if (focus !== undefined) {
            LocalStorageService.instance.setValue('karateIDE.testView.focus', focus);
            this.refresh();
        }
    }

    private getDirShowName(file: string, workspaceFolder: vscode.WorkspaceFolder) {
        let name = path.relative(workspaceFolder.uri.path, file);
        // const tokens = name.split(path.sep);
        // if (tokens.length > 5) {
        //     name = [tokens[0], '...', tokens[tokens.length - 3], tokens[tokens.length - 2], tokens[tokens.length - 1]].join(path.sep);
        // }
        return name;
    }

    private getConfiguredFocusAndTags() {
        return LocalStorageService.instance
            .getValue<string>('karateIDE.testView.focus', '')
            .split(/-t/)
            .map(e => e && e.trim());
    }

    async getChildren(element?: KarateTestTreeEntry): Promise<KarateTestTreeEntry[]> {
        let workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
        let [focus, tags] = this.getConfiguredFocusAndTags();
        let karateFilesInFolders = (await this.getKarateFiles(focus))
            .map(f => f.path)
            .filter(f => !focus || (focus.length > 0 && minimatch(f, focus, { matchBase: true })))
            .reduce((folders, file) => {
                const folder = path.dirname(file);
                const filename = path.basename(file);
                folders[folder] = folders[folder] || [];
                folders[folder].push(filename);
                return folders;
            }, {});

        if (!element) {
            return Object.keys(karateFilesInFolders)
                .sort((a, b) => a.localeCompare(b))
                .map(
                    folder =>
                        new KarateTestTreeEntry({
                            uri: vscode.Uri.file(folder),
                            type: vscode.FileType.Directory,
                            title: this.getDirShowName(folder, workspaceFolder),
                            feature: { path: vscode.Uri.file(folder).fsPath, line: null },
                        })
                );
        }
        if (element.type === vscode.FileType.Directory) {
            return karateFilesInFolders[element.uri.path]
                .sort((a, b) => b.localeCompare(a))
                .map(
                    file =>
                        new KarateTestTreeEntry({
                            uri: vscode.Uri.file(path.join(element.uri.fsPath, file)),
                            type: vscode.FileType.File,
                            title: file,
                            feature: { path: vscode.Uri.file(path.join(element.uri.fsPath, file)).fsPath },
                        })
                );
        } else if (element.type === vscode.FileType.File && element.uri.fsPath.endsWith('.feature')) {
            let tedArray: ITestExecutionDetail[] = await getTestExecutionDetail(element.uri, vscode.FileType.File);
            return tedArray
                .map(
                    ted =>
                        new KarateTestTreeEntry({
                            tags: ted.testTag,
                            uri: vscode.Uri.file(ted.testTitle),
                            type: vscode.FileType.Unknown,
                            title: path.basename(ted.testTitle),
                            feature: { path: element.uri.fsPath, line: ted.testLine },
                            command: {
                                command: 'karateIDE.tests.open',
                                title: 'ted.codelensRunTitle',
                                arguments: [element.uri, ted.testLine],
                            },
                        })
                )
                .filter(t => filterByTags(t.tags, tags));
        }
        if (!karateFilesInFolders || !Object.keys(karateFilesInFolders).length) {
            return [new KarateTestTreeEntry({ uri: null, type: vscode.FileType.Unknown, title: 'No tests found...', feature: null })];
        }
    }

    getTreeItem(element: KarateTestTreeEntry): vscode.TreeItem {
        let collapsibleState: vscode.TreeItemCollapsibleState;
        if (element.type === vscode.FileType.Directory || (element.type === vscode.FileType.File && element.uri.fsPath.endsWith('.feature'))) {
            collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        } else {
            collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        const treeItem = new vscode.TreeItem(element.title, collapsibleState);
        treeItem.command = element.command;

        if (collapsibleState === vscode.TreeItemCollapsibleState.None && element.type !== vscode.FileType.File) {
            treeItem.iconPath = Icons.karateTest;
            treeItem.contextValue = 'test';
        } else if (element.type === vscode.FileType.File && element.uri.fsPath.endsWith('.feature')) {
            treeItem.iconPath = Icons.karateTest;
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
