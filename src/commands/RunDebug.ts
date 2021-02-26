import * as path from 'path';
import { getFileAndRootPath } from '@/helper';
import ProviderStatusBar from '@/views/status-bar/providerStatusBar';
import ProviderExecutions from '@/views/status-bar/providerExecutions';

import * as vscode from 'vscode';
import { ITreeEntryCommand, TreeEntry } from '@/server/KarateEventLogsModels';
import { KarateTestTreeEntry } from '@/views/tests/KarateTestsProvider';
import EventLogsServer from '@/server/EventLogsServer';

let debugFeature: string = null;
let lastExecution = null;

export function debugAllKarateTests(entry: KarateTestTreeEntry) {
    debugKarateTest(entry.feature.path, entry.feature.line);
}

export function debugKarateTest(feature, line) {
    if (feature instanceof KarateTestTreeEntry) {
        return debugAllKarateTests(feature);
    }
    debugFeature = feature + (line ? `:${line}` : '');
    vscode.commands.executeCommand('karateIDE.karateExecutionsTree.clearTree');
    vscode.commands.executeCommand('workbench.action.debug.start');
}

export function getDebugFile() {
    if (!debugFeature) {
        let activeTextEditor: vscode.TextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor !== undefined && activeTextEditor.document.fileName.endsWith('.feature')) {
            debugFeature = activeTextEditor.document.fileName;
        }
    }
    lastExecution = debugFeature;
    return lastExecution;
}

function addHookToClasspath(classpath: string) {
    if (Boolean(vscode.workspace.getConfiguration('karateIDE.karateCli').get('addHookToClasspath'))) {
        return path.join(__dirname, '../resources/vscode.jar') + path.delimiter + classpath;
    }
    return classpath;
}

export function getKarateOptions() {
    const karateEnv: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv');
    const karateOptions: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateOptions');
    if (Boolean(vscode.workspace.getConfiguration('karateIDE.karateCli').get('addHookToClasspath'))) {
        return '-H vscode.VSCodeHook ' + karateOptions;
    }
    return karateOptions.replace('${karateEnv}', karateEnv);
}

export function getDebugCommandLine() {
    const vscodePort = EventLogsServer.getPort();
    const karateEnv: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv');
    const classpath: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath');
    const karateOptions: string = getKarateOptions();
    const debugCommandTemplate: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('debugCommandTemplate');

    return debugCommandTemplate
        .replace('${vscodePort}', vscodePort)
        .replace('${karateEnv}', karateEnv)
        .replace('${classpath}', addHookToClasspath(classpath))
        .replace('${karateOptions}', karateOptions);
}

async function getRunCommandLine(feature: string) {
    const vscodePort = EventLogsServer.getPort();
    const karateEnv: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv');
    const classpath: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath');
    const karateOptions: string = getKarateOptions();
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('runCommandTemplate');

    if (debugCommandTemplate.includes('${KarateTestRunner}')) {
        debugCommandTemplate = debugCommandTemplate.replace('${KarateTestRunner}', await getKarateTestRunnerName());
    }

    return debugCommandTemplate
        .replace('${vscodePort}', vscodePort)
        .replace('${karateEnv}', karateEnv)
        .replace('${classpath}', addHookToClasspath(classpath))
        .replace('${karateOptions}', karateOptions)
        .replace('${feature}', feature);
}

async function getStartMockCommandLine(feature: string) {
    const classpath: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath');
    const karateOptions: string = getKarateOptions();
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('mockServerCommandTemplate');

    if (debugCommandTemplate.includes('${port}')) {
        debugCommandTemplate = debugCommandTemplate.replace('${port}', await vscode.window.showInputBox({ prompt: 'Mock Server Port', value: '0' }));
    }

    return debugCommandTemplate.replace('${classpath}', classpath).replace('${karateOptions}', karateOptions).replace('${feature}', feature);
}

async function getKarateTestRunnerName() {
    let karateJunitRunner = String(vscode.workspace.getConfiguration('karateIDE.karateTestRunner').get('karateJunitRunner'));
    if (Boolean(vscode.workspace.getConfiguration('karateIDE.karateTestRunner').get('promptToSpecify'))) {
        karateJunitRunner = await vscode.window.showInputBox({ prompt: 'Karate JUnit Runner', value: karateJunitRunner });
        if (karateJunitRunner !== undefined && karateJunitRunner !== '') {
            await vscode.workspace.getConfiguration().update('karateIDE.karateIDE.karateJunitRunner', karateJunitRunner);
        }
    }
    return karateJunitRunner;
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

export async function startMockServer(featureFile) {
    const command = await getStartMockCommandLine(featureFile.fsPath);
    let exec = new vscode.ShellExecution(command, {});
    let task = new vscode.Task({ type: 'karate' }, vscode.TaskScope.Workspace, 'Karate Mock Server', 'karate', exec, []);
    vscode.tasks.executeTask(task);
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

    let seo: vscode.ShellExecutionOptions = { cwd: fileAndRootPath.root };
    let exec = new vscode.ShellExecution(runCommand, seo);
    let task = new vscode.Task({ type: 'karate' }, vscode.TaskScope.Workspace, 'Karate Runner', 'karate', exec, []);

    ProviderStatusBar.reset();
    ProviderExecutions.executionArgs = [feature, line];
    vscode.tasks.onDidEndTask(e => {
        if (e.execution.task.name === 'Karate Runner') {
            isTaskExecuting = false;
            ProviderExecutions.addExecutionToHistory();
            ProviderExecutions.executionArgs = null;
        }
    });
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

export function relaunchDebugAll() {
    if (lastExecution) {
        const feature = lastExecution.replace(/:\d+$/, '');
        const line = lastExecution.replace(feature + ':', '');
        debugKarateTest(feature, +line);
    }
}

export function relaunchRunAll() {
    if (lastExecution) {
        const feature = lastExecution.replace(/:\d+$/, '');
        const line = lastExecution.replace(feature + ':', '');
        runKarateTest(feature, +line);
    }
}

export function relaunchDebug(entry: TreeEntry) {
    const feature = path.join(entry.eventStart.currentDir, entry.eventStart.resource);
    debugKarateTest(feature, entry.eventStart.line);
}

export function relaunchRun(entry: TreeEntry) {
    const feature = path.join(entry.eventStart.currentDir, entry.eventStart.resource);
    runKarateTest(feature, entry.eventStart.line);
}
