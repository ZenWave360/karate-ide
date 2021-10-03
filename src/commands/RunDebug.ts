import * as path from 'path';
import { getFileAndRootPath } from '@/helper';

import * as vscode from 'vscode';
import { KarateTestTreeEntry } from '@/fs/FilesManager';
import EventLogsServer from '@/server/EventLogsServer';
import { KarateExecutionProcess } from '@/execution/KarateExecutionProcess';
import { Execution, SuiteExecution } from '@/views/executions/KarateExecutionsTreeProvider';

let debugFeature: string = null;
let lastExecutionType: 'RUN' | 'DEBUG' = null;
let lastExecution = null;

export function debugAllKarateTests(entry: KarateTestTreeEntry) {
    debugKarateTest(entry.feature.path, entry.feature.line);
}

export function debugKarateTest(feature, line) {
    if (feature instanceof KarateTestTreeEntry) {
        return debugAllKarateTests(feature);
    }
    debugFeature = feature + (line > 1 ? `:${line}` : '');
    vscode.commands.executeCommand('workbench.action.debug.start');
}

export function getDebugFile() {
    lastExecutionType = 'DEBUG';
    return (lastExecution = debugFeature);
}

function processClasspath(classpath: string) {
    if (classpath.includes('${m2.repo}')) {
        const m2Repo: string =
            vscode.workspace.getConfiguration('karateIDE.karateCli').get('m2Repo') ||
            (process.env.M2_REPO && process.env.M2_REPO) ||
            (process.env.HOME && path.join(process.env.HOME, '.m2/repository')) ||
            (process.env.UserProfile && path.join(process.env.UserProfile, '.m2/repository'));
        if (m2Repo) {
            classpath = classpath.replace(/\${m2\.repo}/g, m2Repo);
        }
    }
    if (classpath.includes('${ext:karate-ide.jar}')) {
        const classpathJarExtension = vscode.extensions.getExtension('KarateIDE.karate-classpath-jar');
        if (classpathJarExtension) {
            const karateJar = vscode.Uri.joinPath(vscode.Uri.file(classpathJarExtension.extensionPath), 'resources', 'karate.jar').fsPath.replace(
                /\\/g,
                '/'
            );
            classpath = classpath.replace(/\${ext\:karate-ide\.jar}/g, karateJar);
        }
    }
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

export async function getDebugCommandLine() {
    const vscodePort = EventLogsServer.getPort();
    const karateEnv: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv');
    const classpath: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath');
    const karateOptions: string = getKarateOptions();
    const debugCommandTemplate: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('debugCommandTemplate');

    return debugCommandTemplate
        .replace('${vscodePort}', vscodePort)
        .replace('${karateEnv}', karateEnv)
        .replace('${classpath}', processClasspath(classpath))
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
        .replace('${classpath}', processClasspath(classpath))
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

    return debugCommandTemplate
        .replace('${classpath}', processClasspath(classpath))
        .replace('${karateOptions}', karateOptions)
        .replace('${feature}', feature);
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

export async function startMockServer(featureFile: vscode.Uri, featureFiles: vscode.Uri[]) {
    // console.log('startMockServer', arguments);
    const command = await getStartMockCommandLine(featureFiles.map(f => f.fsPath).join(','));
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

    const path = feature + (line > 1 ? `:${line}` : '');
    const fileAndRootPath = getFileAndRootPath(vscode.Uri.file(path));
    const runCommand = await getRunCommandLine(fileAndRootPath.file);

    KarateExecutionProcess.executeInTestServer(fileAndRootPath.root, runCommand);
    lastExecution = path;
    lastExecutionType = 'RUN';
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

export function relaunchDebug(entry: Execution) {
    if (entry instanceof SuiteExecution) {
        return relaunchDebugAll();
    }
    const [feature, line] = entry.eventStart.locationHint.split(':');
    debugKarateTest(path.join(entry.eventStart.cwd, feature), line);
}

export function relaunchRun(entry: Execution) {
    if (entry instanceof SuiteExecution) {
        return relaunchRunAll();
    }
    const [feature, line] = entry.eventStart.locationHint.split(':');
    runKarateTest(path.join(entry.eventStart.cwd, feature), line);
}

export function relaunchLastExecution() {
    lastExecutionType === 'DEBUG' ? relaunchDebugAll() : relaunchRunAll();
}
