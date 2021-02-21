import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as minimatch from 'minimatch';
import { LocalStorageService } from '@/commands/LocalStorageService';
import { filterByTags, getTestExecutionDetail, ITestExecutionDetail } from '@/helper';
import Icons from '@/Icons';

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
    children: KarateTestTreeEntry[];
    tags: any;
    constructor(partial: Partial<KarateTestTreeEntry>) {
        Object.assign(this, partial);
    }
}

export class KarateTestsProvider implements vscode.TreeDataProvider<KarateTestTreeEntry> {
    private workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
    private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    private async getKarateFiles(focus: string): Promise<KarateTestTreeEntry[]> {
        let glob = String(vscode.workspace.getConfiguration('karateIDE.tests').get('globFilter'));
        const karateTestFiles = (await vscode.workspace.findFiles(glob))
            .filter(f => !focus || (focus.length > 0 && minimatch(f.path, focus, { matchBase: true })))
            .map(f => path.relative(this.workspaceFolder.uri.path, f.path))
            .map(f => f.replace(/\\/g, '/'));

        // map of folders (no intermediate levels) and their files (as map)
        const flatFolders: { [index: string]: string[] } = karateTestFiles.reduce((folders, file) => {
            const lastSlash = file.lastIndexOf('/');
            const folder = file.substring(0, lastSlash);
            const filename = file.substring(lastSlash + 1, file.length);
            folders[folder] = folders[folder] || {};
            folders[folder][filename] = file;
            return folders;
        }, {});

        // added intermediate (empty) folders
        const foldersTree = Object.keys(flatFolders).reduce((tree, key) => {
            const folders = key.split('/');
            while (folders.pop()) {
                const folder = folders.join('/');
                tree[folder] = tree[folder] || {};
            }
            tree[key] = { ...tree[key], ...flatFolders[key] };
            return tree;
        }, {});

        // removes itermediate folder that will be empty (no files and just one folder)
        function isEmptyFolder(folderName, folders) {
            if (foldersTree[folderName] && Object.keys(foldersTree[folderName]).length) {
                return false;
            }
            const children = folders.filter(f => f.startsWith(folderName + '/'));
            const childrenDirect = children.map(f => f.substring(folderName.length + 1)).map(f => f.split('/')[0]);
            return new Set(childrenDirect).size < 2;
        }
        const folderNames = Object.keys(foldersTree);
        folderNames.forEach(folderName => {
            if (isEmptyFolder(folderName, folderNames)) {
                delete foldersTree[folderName];
            }
        });

        // builds folder tree by moving each "non empty" folder to its "non empty" parent
        Object.keys(foldersTree)
            // .filter(f => Object.keys(foldersTree[f]).length)
            .sort((a, b) => ((b.match(/\//g) || []).length - (a.match(/\//g) || []).length) * 10 + b.localeCompare(a))
            .forEach(folderKey => {
                const folders = folderKey.split('/');
                while (folders.pop()) {
                    const parent = folders.join('/');
                    if (foldersTree[parent]) {
                        const folder = folderKey.substring(parent.length + 1, folderKey.length);
                        foldersTree[parent][folder] = foldersTree[folderKey];
                        delete foldersTree[folderKey];
                        break;
                    }
                }
            });

        return this.convertToEntryTree(foldersTree);
    }

    private convertToEntryTree(foldersEntry): KarateTestTreeEntry[] {
        if (typeof foldersEntry === 'object') {
            return Object.entries(foldersEntry)
                .map(([key, value]) => {
                    const isDirectory = typeof value === 'object';
                    const file = isDirectory ? key : (value as string);
                    const uri = vscode.Uri.file(path.join(this.workspaceFolder.uri.fsPath, file));
                    return new KarateTestTreeEntry({
                        uri,
                        type: isDirectory ? vscode.FileType.Directory : vscode.FileType.File,
                        title: this.getDirShowName(key),
                        feature: { path: uri.fsPath, line: null },
                        children: isDirectory ? this.convertToEntryTree(value) : null,
                    });
                })
                .sort((a, b) => b.type.toString().localeCompare(a.type.toString()) * 10 + a.title.localeCompare(b.title));
        }
        return foldersEntry;
    }

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
            return await this.getKarateFiles(focus);
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
