import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as minimatch from 'minimatch';
import { filesManager, KarateTestTreeEntry } from '@/fs/FilesManager';
import { LocalStorageService } from '@/commands/LocalStorageService';
import { filterByTags, getTestExecutionDetail, ITestExecutionDetail } from '@/helper';
import Icons from '@/Icons';
export class KarateTestsProvider implements vscode.TreeDataProvider<KarateTestTreeEntry> {
    private workspaceFolder =
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
    private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    public refresh(): any {
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

    private getDirShowName(file: string) {
        let name = path.relative(this.workspaceFolder.uri.path, file);
        // const tokens = name.split(path.sep);
        // if (tokens.length > 5) {
        //     name = [tokens[0], '...', tokens[tokens.length - 3], tokens[tokens.length - 2], tokens[tokens.length - 1]].join(path.sep);
        // }
        return file; // name;
    }

    private getConfiguredFocusAndTags() {
        return LocalStorageService.instance
            .getValue<string>('karateIDE.testView.focus', '')
            .split(/-t/)
            .map(e => e && e.trim());
    }

    async getChildren(element?: KarateTestTreeEntry): Promise<KarateTestTreeEntry[]> {
        let [focus, tags] = this.getConfiguredFocusAndTags();

        if (!element) {
            return await filesManager.getKarateFiles(focus);
        }
        if (element.type === vscode.FileType.Directory) {
            return element.children;
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
        // if (!karateFilesInFolders || !Object.keys(karateFilesInFolders).length) {
        //     return [new KarateTestTreeEntry({ uri: null, type: vscode.FileType.Unknown, title: 'No tests found...', feature: null })];
        // }
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

export default KarateTestsProvider;
