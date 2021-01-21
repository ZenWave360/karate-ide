import { getFileAndRootPath, getActiveFeatureFile } from '../helper';
import ProviderStatusBar from '../providerStatusBar';
import ProviderExecutions from '../providerExecutions';

import * as vscode from 'vscode';
import { TreeEntry } from '../events-log-server/KarateEventLogsModels';
import { IEntry } from '../providerKarateTests';

let debugAllFile: string = null;
let debugLineNumber: number = 0;
let lastDebugExecution = null;
let isRelaunchLastDebugExecution = false;

export async function getDebugFile() {
    if (isRelaunchLastDebugExecution) {
        isRelaunchLastDebugExecution = false;
        return lastDebugExecution;
    }

    if (debugAllFile) {
        const debugFile = debugAllFile;
        debugAllFile = null;
        return debugFile;
    }

    let debugLine: string = debugLineNumber === 0 ? '' : `:${debugLineNumber}`;
    debugLineNumber = 0;

    let activeKarateFile: string = await getActiveFeatureFile();
    debugAllFile == null;

    if (activeKarateFile !== null) {
        return (lastDebugExecution = activeKarateFile + debugLine);
    } else {
        return '';
    }
}

export function runAllKarateTests(entry: IEntry) {
    runKarateTest([entry.feature.path, entry.feature.line]);
}

export function debugAllKarateTests(entry: IEntry) {
    debugAllFile = entry.feature.path + (entry.feature.line ? `:${entry.feature.line}` : '');
    debugKarateTest();
}

export function getDebugCommandLine() {
    let vscodePort: string = vscode.workspace.getConfiguration('karateRunner.eventLogsServer').get('port');
    let karateEnv: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('karateEnv');
    let classpath: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('classpath');
    let karateOptions: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('karateOptions');
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('debugCommandTemplate');

    return debugCommandTemplate
        .replace('${vscodePort}', vscodePort)
        .replace('${karateEnv}', karateEnv)
        .replace('${classpath}', classpath)
        .replace('${karateOptions}', karateOptions);
}

async function getRunCommandLine(feature: string) {
    let vscodePort: string = vscode.workspace.getConfiguration('karateRunner.eventLogsServer').get('port');
    let karateEnv: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('karateEnv');
    let classpath: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('classpath');
    let karateOptions: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('karateOptions');
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('runCommandTemplate');

    if (debugCommandTemplate.includes('${KarateTestRunner}')) {
        debugCommandTemplate = debugCommandTemplate.replace('${KarateTestRunner}', await getKarateTestRunnerName());
    }

    return debugCommandTemplate
        .replace('${vscodePort}', vscodePort)
        .replace('${karateEnv}', karateEnv)
        .replace('${classpath}', classpath)
        .replace('${karateOptions}', karateOptions)
        .replace('${feature}', feature);
}

async function getKarateTestRunnerName() {
    let karateRunner = String(vscode.workspace.getConfiguration('karateRunner.karateRunner').get('default'));
    if (Boolean(vscode.workspace.getConfiguration('karateRunner.karateRunner').get('promptToSpecify'))) {
        karateRunner = await vscode.window.showInputBox({ prompt: 'Karate Runner', value: karateRunner });
        if (karateRunner !== undefined && karateRunner !== '') {
            await vscode.workspace.getConfiguration().update('karateRunner.karateRunner.default', karateRunner);
        }
    }
    return karateRunner;
}

function getActiveDocumentExecution() {
    const activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
    if (!activeEditor.document.fileName.toLowerCase().endsWith('.feature')) {
        return null;
    }
    let line = activeEditor.selection.active.line + 1;
    while (!activeEditor.document.lineAt(--line).text.match(/^\s*(?:Scenario)|\|/)) {}
    if (line > 1) {
        return activeEditor.document.uri.fsPath + ':' + (line + 1);
    }
    return activeEditor.document.uri.fsPath;
}

export async function runKarateTest(args) {
    console.log('launchKarateTest', args);
    if (args === null) {
        args = [getActiveDocumentExecution()];
    }
    const path = args[0];
    const fileAndRootPath = getFileAndRootPath(vscode.Uri.file(path));
    const runCommand = await getRunCommandLine(fileAndRootPath.file);

    const openReports = Boolean(vscode.workspace.getConfiguration('karateRunner.buildReports').get('openAfterEachRun'));
    let watcher = null;
    let reportUrisFound: vscode.Uri[] = [];
    if (openReports) {
        let relativePattern = new vscode.RelativePattern(
            fileAndRootPath.root,
            String(vscode.workspace.getConfiguration('karateRunner.buildReports').get('toTarget'))
        );
        watcher = vscode.workspace.createFileSystemWatcher(relativePattern);
        watcher.onDidCreate((e: vscode.Uri) => reportUrisFound.push(e));
        watcher.onDidChange((e: vscode.Uri) => reportUrisFound.push(e));
    }
    vscode.tasks.onDidEndTask(e => {
        if (e.execution.task.name == 'Karate Runner') {
            isTaskExecuting = false;
            watcher && watcher.dispose();

            ProviderExecutions.addExecutionToHistory();
            ProviderExecutions.executionArgs = null;

            if (openReports) {
                new Set(reportUrisFound).forEach(reportUri => vscode.env.openExternal(reportUri));
            }
        }
    });

    let seo: vscode.ShellExecutionOptions = { cwd: fileAndRootPath.root };
    let exec = new vscode.ShellExecution(runCommand, seo);
    let task = new vscode.Task({ type: 'karate' }, vscode.TaskScope.Workspace, 'Karate Runner', 'karate', exec, []);

    ProviderStatusBar.reset();
    ProviderExecutions.executionArgs = args;

    let showProgress = (task: vscode.TaskExecution) => {
        vscode.window.withProgress({ location: { viewId: 'karate-tests' }, cancellable: false }, async progress => {
            await new Promise<void>(resolve => {
                let interval = setInterval(() => {
                    if (!isTaskExecuting) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 1000);
            });
        });
    };

    let isTaskExecuting = true;
    vscode.commands.executeCommand('karateRunner.karateExecutionsTree.clearTree');
    vscode.tasks.executeTask(task).then(task => showProgress(task));
}

export function relaunchLastKarateDebugExecution() {
    isRelaunchLastDebugExecution = true;
    debugKarateTest();
}

export function launchKarateDebugExecution(entry: TreeEntry) {
    console.log('launchKarateDebugExecution', entry);
    isRelaunchLastDebugExecution = true;
    lastDebugExecution = entry.eventStart.resource + ':' + entry.eventStart.line;
    debugKarateTest();
}

export function debugKarateTest(args = null) {
    if (args !== null) {
        debugLineNumber = args[0];
    } else {
        debugLineNumber = 0;
    }

    vscode.commands.executeCommand('karateRunner.karateExecutionsTree.clearTree');
    vscode.commands.executeCommand('workbench.action.debug.start');
}
