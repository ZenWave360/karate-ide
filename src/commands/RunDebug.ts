import { getFileAndRootPath, getActiveFeatureFile } from '../helper';
import ProviderStatusBar from '../providerStatusBar';
import ProviderExecutions from '../providerExecutions';

import * as vscode from 'vscode';
import { TreeEntry } from '../events-log-server/KarateEventLogsModels';
import { KarateTestTreeEntry } from '../providerKarateTests';

let debugFeature: string = null;
let lastExecution = null;

export function debugAllKarateTests(entry: KarateTestTreeEntry) {
    debugKarateTest(entry.feature.path, entry.feature.line);
}

export function debugKarateTest(feature, line) {
    if (feature instanceof KarateTestTreeEntry) {
        return runAllKarateTests(feature);
    }
    debugFeature = feature + (line ? `:${line}` : '');
    vscode.commands.executeCommand('karateIDE.karateExecutionsTree.clearTree');
    vscode.commands.executeCommand('workbench.action.debug.start');
}

export async function getDebugFile() {
    lastExecution = debugFeature;
    if (!lastExecution) {
        lastExecution = await getActiveFeatureFile();
    }
    debugFeature = null;
    return lastExecution;
}

export function getDebugCommandLine() {
    let vscodePort: string = vscode.workspace.getConfiguration('karateIDE.eventLogsServer').get('port');
    let karateEnv: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv');
    let classpath: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath');
    let karateOptions: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateOptions');
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('debugCommandTemplate');

    return debugCommandTemplate
        .replace('${vscodePort}', vscodePort)
        .replace('${karateEnv}', karateEnv)
        .replace('${classpath}', classpath)
        .replace('${karateOptions}', karateOptions);
}

async function getRunCommandLine(feature: string) {
    let vscodePort: string = vscode.workspace.getConfiguration('karateIDE.eventLogsServer').get('port');
    let karateEnv: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv');
    let classpath: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath');
    let karateOptions: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateOptions');
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('runCommandTemplate');

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
    let karateRunner = String(vscode.workspace.getConfiguration('karateIDE.karateRunner').get('default'));
    if (Boolean(vscode.workspace.getConfiguration('karateIDE.karateRunner').get('promptToSpecify'))) {
        karateRunner = await vscode.window.showInputBox({ prompt: 'Karate Runner', value: karateRunner });
        if (karateRunner !== undefined && karateRunner !== '') {
            await vscode.workspace.getConfiguration().update('karateIDE.karateIDE.default', karateRunner);
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

export function runAllKarateTests(entry: KarateTestTreeEntry) {
    runKarateTest(entry.feature.path, entry.feature.line);
}

export async function runKarateTest(feature, line) {
    if (feature instanceof KarateTestTreeEntry) {
        return runAllKarateTests(feature);
    }
    feature = feature || getActiveDocumentExecution();
    //args = args.feature ? [args.feature.path, args.feature.line] : args;

    const path = feature + (line ? `:${line}` : '');
    const fileAndRootPath = getFileAndRootPath(vscode.Uri.file(path));
    const runCommand = await getRunCommandLine(fileAndRootPath.file);

    const openReports = Boolean(vscode.workspace.getConfiguration('karateIDE.buildReports').get('openAfterEachRun'));
    let watcher = null;
    let reportUrisFound: vscode.Uri[] = [];
    if (openReports) {
        let relativePattern = new vscode.RelativePattern(
            fileAndRootPath.root,
            String(vscode.workspace.getConfiguration('karateIDE.buildReports').get('toTarget'))
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
    ProviderExecutions.executionArgs = [feature, line];

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
    vscode.commands.executeCommand('karateIDE.karateExecutionsTree.clearTree');
    vscode.tasks.executeTask(task).then(task => showProgress(task));
}

export function relaunchLastKarateDebugExecution() {
    if (lastExecution) {
        const feature = lastExecution.replace(/:\d+$/, '');
        const line = lastExecution.replace(feature + ':', '');
        debugKarateTest(feature, +line);
    }
}

export function launchKarateDebugExecution(entry: TreeEntry) {
    debugKarateTest(entry.eventStart.resource, entry.eventStart.line + 1);
}
