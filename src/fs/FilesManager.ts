import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as minimatch from 'minimatch';
import { getFileAndRootPath } from '@/helper';
import { addFeature, reloadFeature, reloadKarateTestsController, removeFeature } from '@/execution/KarateTestsManager';

export class KarateTestTreeEntry {
    uri: vscode.Uri;
    type: vscode.FileType;
    title: string;
    children: KarateTestTreeEntry[];
    constructor(partial: Partial<KarateTestTreeEntry>) {
        Object.assign(this, partial);
    }
}

class FilesManager {
    private workspaceFolder;
    private workspaceFsPath;
    private testsGlobFilter: string;
    private classpathFolders: string[];
    private cachedKarateTestFiles: string[];
    private cachedClasspathFiles: string[];
    private watcher;

    constructor() {
        this.workspaceFolder =
            vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
        this.workspaceFsPath = this.workspaceFolder && this.workspaceFolder.uri.fsPath;

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('karateIDE.tests.globFilter') || e.affectsConfiguration('karateIDE.karateCli.classpath')) {
                this.loadFiles();
            }
        });

        this.loadFiles();
    }

    public loadFiles = async () => {
        this.testsGlobFilter = String(vscode.workspace.getConfiguration('karateIDE.tests').get('globFilter'));

        this.cachedKarateTestFiles = (await vscode.workspace.findFiles(this.testsGlobFilter))
            // .filter(f => !focus || (focus.length > 0 && minimatch(f.path, focus, { matchBase: true })))
            .map(f => path.relative(this.workspaceFolder.uri.path, f.path))
            .map(f => f.replace(/\\/g, '/'));

        this.cachedClasspathFiles = [];
        this.classpathFolders = [];
        const classpathFolders = String(vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath')).split(path.delimiter);
        const rootModuleMarkerFile = String(vscode.workspace.getConfiguration('karateIDE.multimodule').get('rootModuleMarkerFile'));
        this.classpathFolders = (await vscode.workspace.findFiles('**/' + rootModuleMarkerFile)).flatMap(root => {
            return classpathFolders
                .map(f => path.relative(this.workspaceFolder.uri.fsPath, path.join(path.dirname(root.fsPath), f)))
                .map(f => f.replace(/\\/g, '/'));
        });

        this.classpathFolders.forEach(async classpathFolder => {
            const entries = (await vscode.workspace.findFiles('**/' + classpathFolder + '/**/*.{feature,yml,json}'))
                .map(f => path.relative(path.join(this.workspaceFolder.uri.fsPath, classpathFolder), f.fsPath))
                .map(f => f.replace(/\\/g, '/'));
            this.cachedClasspathFiles.push(...entries);
        });

        reloadKarateTestsController();
        this.watch();
    };

    private watch() {
        this.watcher && this.watcher.dispose();
        this.watcher = vscode.workspace.createFileSystemWatcher(this.testsGlobFilter);
        this.watcher.onDidCreate(uri => addFeature(uri));
        this.watcher.onDidChange(uri => reloadFeature(uri));
        this.watcher.onDidDelete(uri => removeFeature(uri));
    }

    public getPeekDefinitions(document: vscode.TextDocument, token: string): vscode.Definition {
        let [file, tag] = token.split('@');
        const definitions = [];
        if (file && file.startsWith('classpath:')) {
            file = file.replace('classpath:', '');
            if (file.endsWith('.feature') || file.endsWith('.yml') || file.endsWith('.json') || file.endsWith('.js')) {
                definitions.push(...this.findInClassPathFolders(file));
            } else {
                definitions.push(
                    ...this.cachedClasspathFiles
                        .filter(f => minimatch(f, file + '*', { matchBase: true }))
                        .flatMap(f => this.findInClassPathFolders(f))
                );
            }
        } else if (file) {
            const f = path.join(path.dirname(document.uri.fsPath), file);
            if (fs.existsSync(f) && fs.statSync(f).isFile()) {
                definitions.push(f);
            } else {
                definitions.push(...this.cachedKarateTestFiles.filter(f => minimatch(f, file + '*', { matchBase: true })));
            }
        } else {
            definitions[0] = document.uri.fsPath;
        }

        if (definitions.length === 1 && tag) {
            // console.log('searching for @tag', tag);
            const lines = fs.readFileSync(definitions[0]).toString().split('\n');
            for (let line = 0; line < lines.length; line++) {
                if (new RegExp(`^\\s*(@\\w+)*\\s*(@${tag})\\s*(@\\w+)*\\s*$`, 'g').exec(lines[line])) {
                    // console.log('peeking with @tag', definitions[0], line);
                    return new vscode.Location(vscode.Uri.file(definitions[0]), new vscode.Position(line, 0));
                }
            }
        }
        // console.log('peeking', definitions);
        return definitions.map(f => new vscode.Location(vscode.Uri.file(f), new vscode.Position(0, 0)));
    }

    private findInClassPathFolders(file) {
        const result = this.classpathFolders
            .map(folder => path.join(this.workspaceFsPath, folder, file))
            .filter(f => fs.existsSync(f))
            .filter((value, index) => index === 0);
        // console.log(result);
        return result;
    }

    public getClasspathRelativePath(file: vscode.Uri) {
        let relativePath = vscode.workspace.asRelativePath(file.fsPath);
        for (const folder of this.classpathFolders) {
            if (relativePath.startsWith(folder)) {
                relativePath = relativePath.replace(folder, '');
                relativePath = relativePath.replace(/^\//g, '');
                break;
            }
        }

        return relativePath.replace(/\\/g, '/');
    }

    public getAutoCompleteEntries(documentUri: vscode.Uri, completionToken: string): vscode.CompletionItem[] {
        const relativeTo = path.relative(this.workspaceFolder.uri.fsPath, path.dirname(documentUri.fsPath)).replace(/\\/g, '/');
        let completionStrings = [];
        completionStrings.push(...this.cachedKarateTestFiles.filter(f => f));
        completionStrings.push(...this.cachedClasspathFiles.map(f => `classpath:${f}`));
        let completionItems = completionStrings.map(f => new vscode.CompletionItem(`classpath:${f}`, vscode.CompletionItemKind.File));
        // completionItems.push(...this.cachedKarateTestFiles.filter(f => f).map(f => new vscode.CompletionItem(f, vscode.CompletionItemKind.File)));
        // completionItems.push(...this.cachedClasspathFiles.map(f => new vscode.CompletionItem(`classpath:${f}`, vscode.CompletionItemKind.File)));
        return completionItems.filter(item => item.label.toString().startsWith(completionToken));
    }

    public getKarateFiles(focus?: string): KarateTestTreeEntry[] {
        const filteredEntries = (this.cachedKarateTestFiles || []).filter(
            f => !focus || (focus.length > 0 && minimatch(f, focus, { matchBase: true }))
        );
        return this.buildEntriesTree(filteredEntries);
    }

    public buildEntriesTree(entries: string[]) {
        // map of folders (no intermediate levels) and their files (as map)
        const flatFolders: { [index: string]: string[] } = entries.reduce((folders, file) => {
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

    private convertToEntryTree(foldersEntry, parentFolder = ''): KarateTestTreeEntry[] {
        if (typeof foldersEntry === 'object') {
            return Object.entries(foldersEntry)
                .map(([key, value]) => {
                    const isDirectory = typeof value === 'object';
                    const file = isDirectory ? path.join(parentFolder, key) : (value as string);
                    const uri = vscode.Uri.file(path.join(this.workspaceFolder.uri.fsPath, file));
                    return new KarateTestTreeEntry({
                        uri,
                        type: isDirectory ? vscode.FileType.Directory : vscode.FileType.File,
                        title: key,
                        // feature: { path: uri.fsPath, line: null },
                        children: isDirectory ? this.convertToEntryTree(value, vscode.workspace.asRelativePath(uri.fsPath, false)) : null,
                    });
                })
                .sort((a, b) => b.type.toString().localeCompare(a.type.toString()) * 10 + a.title.localeCompare(b.title));
        }
        return foldersEntry;
    }
}

export const filesManager = new FilesManager();
