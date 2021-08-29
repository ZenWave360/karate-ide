import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import {
    Execution,
    FeatureExecution,
    karateExecutionsTreeProvider as executionsTreeProvider,
    ScenarioExecution,
    ScenarioOutlineExecution,
    SuiteExecution,
} from '@/views/executions/KarateExecutionsTreeProvider';

export type Event = {
    event: string;
    locationHint: string;
    cwd: string;
    name: string;
    message: string;
    details: string;
    features: string;
    featuresFound: string;
    outline: boolean;
    dynamic: boolean;
};

class StringBuffer {
    private buffer: string = '';

    append(data: string) {
        this.buffer += data;
    }
    clear() {
        this.buffer = '';
    }
    get() {
        return this.buffer;
    }
}

export class KarateExecutionProcess {
    static karateChannel = vscode.window.createOutputChannel('Karate');
    static suiteLogs = new StringBuffer();
    static featuresLogsMap = new Map<string, StringBuffer>();
    static scenariosLogsMap = new Map<string, StringBuffer>();
    static scenarioOutlineLogsMap = new Map<string, StringBuffer>();
    static featureLog: StringBuffer;
    static scenarioLog: StringBuffer;
    static scenarioOutlineLog: StringBuffer;
    static child: ChildProcessWithoutNullStreams = null;
    static isExecuting = false;

    static showOutputLogs(execution: Execution) {
        const _this = KarateExecutionProcess;
        try {
            _this.karateChannel.clear();
            if (execution instanceof SuiteExecution) {
                _this.karateChannel.append(_this.suiteLogs.get());
            } else if (execution instanceof FeatureExecution) {
                _this.karateChannel.append(_this.featuresLogsMap.get(execution.name).get());
            } else if (execution instanceof ScenarioExecution) {
                _this.karateChannel.append(_this.scenariosLogsMap.get(execution.name).get());
            } else if (execution instanceof ScenarioOutlineExecution) {
                _this.karateChannel.append(_this.scenarioOutlineLogsMap.get(execution.name).get());
            }
            _this.karateChannel.show();
        } catch (e) {
            console.error('showOutputLogs', e.message);
        }
    }

    static execute(cwd: string, command: string, onDebugReadyCallback?: (port: number) => any) {
        if (this.isExecuting) {
            vscode.window.showInformationMessage('Karate is already running', 'Cancel').then(selection => {
                if (selection === 'Cancel' && this.isExecuting) {
                    this.child && this.child.kill();
                    this.karateChannel.appendLine('[Canceled]');
                }
            });
            return;
        }
        this.isExecuting = true;
        executionsTreeProvider.clear();
        this.suiteLogs.clear();
        this.featuresLogsMap.clear();
        this.scenariosLogsMap.clear();
        this.karateChannel.clear();
        this.karateChannel.appendLine(`Executing: ${command}\n`);
        this.suiteLogs.append(`Executing: ${command}\n\n`);
        this.karateChannel.show(true);
        vscode.commands.executeCommand('karate-executions.focus');
        vscode.commands.executeCommand('karate-network-logs.focus');

        const isDebug = onDebugReadyCallback !== undefined;
        const location = isDebug ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification;
        const title = isDebug ? 'Debugging' : 'Karate';
        vscode.window.withProgress({ location, title, cancellable: true }, async (progress, token) => {
            token.onCancellationRequested(() => {
                this.child && this.child.kill();
                this.karateChannel.appendLine('[Canceled]');
            });
            this.doExecute(cwd, command, progress, onDebugReadyCallback);
            await new Promise<void>(resolve => {
                let interval = setInterval(() => {
                    if (!this.isExecuting) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 1000);
            });
        });
    }

    private static doExecute(cwd: string, command: string, progress: vscode.Progress<{ message: string }>, callback: (port: number) => any) {
        const argv = parseArgsStringToArgv(command);
        const child = (this.child = spawn(argv[0], argv.splice(1), { cwd }));
        let isDebugStarted = callback === null;
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', data => {
            data.split(/\r?\n/g)
                .slice(0, -1)
                .forEach(line => {
                    if (!isDebugStarted && line.includes('debug server started')) {
                        const port = /\d+$/.exec(line)[0];
                        callback(+port);
                    }
                    if (line.startsWith('##vscode {')) {
                        try {
                            const event: Event = JSON.parse(line.substring(9, line.lastIndexOf('}') + 1));
                            executionsTreeProvider.processEvent({ ...event, cwd });

                            if (event.event === 'featureStarted') {
                                this.featureLog = new StringBuffer();
                                this.featuresLogsMap.set(event.name, this.featureLog);
                                progress.report({ message: `${event.name}` });
                            } else if (event.event === 'testStarted') {
                                this.scenarioLog = new StringBuffer();
                                this.scenariosLogsMap.set(event.name, this.scenarioLog);
                                progress.report({ message: `${event.name}` });
                            } else if (event.event === 'testOutlineStarted') {
                                this.scenarioOutlineLog = new StringBuffer();
                                this.scenarioOutlineLogsMap.set(event.name, this.scenarioOutlineLog);
                                progress.report({ message: `${event.name}` });
                            } else if (event.event === 'testFinished' || event.event === 'testFailed') {
                                this.scenarioLog = null;
                            } else if (event.event === 'testOutlineFinished') {
                                this.scenarioOutlineLog = null;
                            } else if (event.event === 'featureFinished') {
                                this.featureLog = null;
                            }
                        } catch (e) {
                            console.error('KarateExecutionProcess.on.data', line, e);
                        }
                    } else {
                        this.suiteLogs.append(line + '\n');
                        this.featureLog && this.featureLog.append(line + '\n');
                        this.scenarioLog && this.scenarioLog.append(line + '\n');
                        this.scenarioOutlineLog && this.scenarioOutlineLog.append(line + '\n');
                        this.karateChannel.append(line + '\n');
                    }
                });
        });

        child.stderr.setEncoding('utf8');
        child.stderr.on('data', data => {
            this.karateChannel.append(data);
            if (data.includes('java.lang.ClassNotFoundException')) {
                const message = `
    NOTE: If you're seeing this message your "karateIDE.karateCli.classpath" setting is probably misconfigured.
    Please refer to the documentation for more information https://github.com/ivangsa/karate-ide#karate-classpath
    And run the "Configure Karate-IDE karate classpath" command for assistance (View > Command Palette or Ctrl+Shift+P).
    You can also consider installing "KarateIDE Classpath Jar" extension so you don't need to download karate.jar
    and stay up to date with the latest and greatest Karate release (coming soon).
                `;
                this.karateChannel.appendLine(message);
            }
        });

        child.on('close', code => {
            this.isExecuting = false;
            this.karateChannel.append('.\n');
        });
    }

}


function parseArgsStringToArgv(value: string, env?: string, file?: string): string[] {
    // ([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*) Matches nested quotes until the first space outside of quotes

    // [^\s'"]+ or Match if not a space ' or "

    // (['"])([^\5]*?)\5 or Match "quoted text" without quotes
    // `\3` and `\5` are a backreference to the quote style (' or ") captured
    const myRegexp = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi;
    const myString = value;
    const myArray: string[] = [];
    if (env) {
        myArray.push(env);
    }
    if (file) {
        myArray.push(file);
    }
    let match: RegExpExecArray | null;
    do {
        // Each call to exec returns the next regex match as an array
        match = myRegexp.exec(myString);
        if (match !== null) {
            // Accepts any number of arguments, and returns the first one that is a string
            // (even an empty string)
            function firstString(...args: Array<any>): string | undefined {
                for (let i = 0; i < args.length; i++) {
                    const arg = args[i];
                    if (typeof arg === 'string') {
                        return arg;
                    }
                }
            }
            // Index 1 in the array is the captured group if it exists
            // Index 0 is the matched text, which we use if no captured group exists
            myArray.push(firstString(match[1], match[6], match[0])!);
        }
    } while (match !== null);

    return myArray;
}
