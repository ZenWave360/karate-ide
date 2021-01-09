import { getFileAndRootPath, getTestExecutionDetail, getActiveFeatureFile, ITestExecutionDetail } from './helper';
import { Feature, ISection } from './feature';
import ProviderStatusBar from './providerStatusBar';
import ProviderExecutions from './providerExecutions';
import parse = require('parse-curl');
import * as vscode from 'vscode';
import { TreeEntry } from './model/KarateEventLogsModels';

let debugAllFile: string = null;
let debugLineNumber: number = 0;
let lastDebugExecution = null;
let isRelaunchLastDebugExecution = false;

async function smartPaste() {
    const curlIgnores = ['accept-', 'upgrade-', 'user-', 'connection', 'referer', 'sec-', 'origin', 'host', 'content-length'];

    let curlIgnoreHeader = (header: string) => {
        for (let ignore of curlIgnores) {
            if (header.toLowerCase().startsWith(ignore)) {
                return true;
            }
        }

        return false;
    };

    let convertCurl = (raw: string) => {
        let steps: Array<string> = [];
        raw = raw.replace('--data-binary', '--data');
        const curl: object = parse(raw);
        steps.push("* url '" + curl['url'] + "'");
        const headers: object = curl['header'] || {};

        for (let key of Object.keys(headers)) {
            if (curlIgnoreHeader(key)) {
                continue;
            }

            let val: string = headers[key];
            steps.push('* header ' + key + " = '" + val + "'");
        }

        let method: string = curl['method'];
        let body = curl['body'];

        if (!body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            body = "''";
        }

        if (body) {
            steps.push('* request ' + body);
        }

        steps.push('* method ' + method.toLowerCase());
        return steps.join('\n');
    };

    let editor = vscode.window.activeTextEditor;
    let start = editor.selection.start;

    vscode.commands.executeCommand('editor.action.clipboardPasteAction').then(() => {
        let end = editor.selection.end;
        let selection = new vscode.Selection(start.line, start.character, end.line, end.character);
        let selectedText = editor.document.getText(selection).trim();

        if (selectedText.startsWith('curl')) {
            editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(selection, convertCurl(selectedText) + '\n');
                editor.revealRange(new vscode.Range(start, start));
            });
        }
    });
}

async function getDebugFile() {
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

function runAllKarateTests(args) {
    runKarateTest([args.uri ? args.uri.fsPath : args]);
}

function debugAllKarateTests(args) {
    debugAllFile = args.uri ? args.uri.fsPath : args;
    debugKarateTest();
}

function getDebugCommandLine() {
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

function getRunCommandLine(feature: string) {
    let vscodePort: string = vscode.workspace.getConfiguration('karateRunner.eventLogsServer').get('port');
    let karateEnv: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('karateEnv');
    let classpath: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('classpath');
    let karateOptions: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('karateOptions');
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateRunner.karateCli').get('runCommandTemplate');

    return debugCommandTemplate
        .replace('${vscodePort}', vscodePort)
        .replace('${karateEnv}', karateEnv)
        .replace('${classpath}', classpath)
        .replace('${karateOptions}', karateOptions)
        .replace('${feature}', feature);
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

function runKarateTest(args) {
    console.log('launchKarateTest', args);
    if (args === null) {
        args = [getActiveDocumentExecution()];
    }
    const path = args[0];
    const fileAndRootPath = getFileAndRootPath(vscode.Uri.file(path));
    const runCommand = getRunCommandLine(fileAndRootPath.file);

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
                new Set(reportUrisFound).forEach(reportUri => openBuildReport(reportUri));
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
    vscode.tasks.executeTask(task).then(task => showProgress(task));
}

function relaunchLastKarateDebugExecution() {
    isRelaunchLastDebugExecution = true;
    debugKarateTest();
}

function launchKarateDebugExecution(entry: TreeEntry) {
    console.log('launchKarateDebugExecution', entry);
    isRelaunchLastDebugExecution = true;
    lastDebugExecution = entry.eventStart.resource + ':' + entry.eventStart.line;
    debugKarateTest();
}

function debugKarateTest(args = null) {
    if (args !== null) {
        debugLineNumber = args[0];
    } else {
        debugLineNumber = 0;
    }

    vscode.commands.executeCommand('karateRunner.karateExecutionsTree.clearTree');
    vscode.commands.executeCommand('workbench.action.debug.start');
}

function displayReportsTree(displayType) {
    vscode.workspace.getConfiguration().update('karateRunner.buildReports.activityBarDisplayType', displayType);
}

function displayTestsTree(displayType) {
    vscode.workspace.getConfiguration().update('karateRunner.tests.activityBarDisplayType', displayType);
}

function openBuildReport(reportUri) {
    vscode.env.openExternal(reportUri);
}

function openFileInEditor(uri, line = 1) {
    var position = new vscode.Position(line, 0);
    vscode.window.showTextDocument(uri).then(editor => {
        editor.selections = [new vscode.Selection(position, position)];
        editor.revealRange(new vscode.Range(position, position));
    });
}

export {
    smartPaste,
    getDebugFile,
    getDebugCommandLine,
    debugKarateTest,
    runKarateTest,
    runAllKarateTests,
    debugAllKarateTests,
    displayReportsTree,
    displayTestsTree,
    openBuildReport,
    openFileInEditor,
    relaunchLastKarateDebugExecution,
    launchKarateDebugExecution,
};
