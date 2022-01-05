import * as vscode from 'vscode';
import * as net from 'net';
import * as http from 'http';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import {
    Execution,
    FeatureExecution,
    karateExecutionsTreeProvider as executionsTreeProvider,
    ScenarioExecution,
    ScenarioOutlineExecution,
    SuiteExecution,
} from '@/views/KarateExecutionsTreeProvider';
import * as karateTestManager from '@/execution/KarateTestsManager';
import { karateOutputChannel } from './KarateOutputChannel';

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
    duration: number;
};

export type SummaryEvent = { running: boolean; passed: number; failed: number };
type TestServerProcess = { cwd?: string; env?: string; port?: number; process?: ChildProcessWithoutNullStreams };
export class KarateExecutionProcess {
    static debugProcess: TestServerProcess = {};
    static runProcess: TestServerProcess = {};
    static isExecuting = false;
    static summary: SummaryEvent = { running: false, passed: 0, failed: 0 };
    static onExecuting: vscode.EventEmitter<SummaryEvent> = new vscode.EventEmitter<SummaryEvent>();

    private static progress: vscode.Progress<{ message: string }>;
    private static reportProgress(message: { message: string }) {
        return this.progress ? this.progress.report(message) : null;
    }

    public static get onExecutingEvent(): vscode.Event<any> {
        return this.onExecuting.event;
    }

    public static stopTestProcesses() {
        this.debugProcess.process && this.debugProcess.process.kill();
        this.runProcess.process && this.runProcess.process.kill();
        this.debugProcess.process = this.debugProcess.port = this.runProcess.process = this.runProcess.port = null;
        this.isExecuting = false;
    }

    public static executeInTestServer(cwd: string, command: string) {
        command = this.useKarateTestServer(command);
        this.killProcessIfDifferentCwd(this.runProcess, cwd);
        this.executeProcess(this.runProcess, command, false, port => this.executeOnTestProcess(port, command));
    }

    public static executeInDebugServer(cwd: string, command: string, onDebugReadyCallback?: (port: number) => any) {
        command = this.useKarateTestServer(command);
        this.killProcessIfDifferentCwd(this.debugProcess, cwd);
        this.executeProcess(this.debugProcess, command, true, onDebugReadyCallback);
    }

    private static executeProcess(testServer: TestServerProcess, command: string, isDebug: boolean, onPortReadyCallback?: (port: number) => any) {
        if (this.isExecuting) {
            vscode.window.showInformationMessage('Karate is already running', 'Cancel').then(selection => {
                if (selection === 'Cancel' && this.isExecuting) {
                    testServer.process && testServer.process.kill();
                    karateOutputChannel.append('[Canceled]\n', false);
                    this.onExecuting.fire({ running: false, passed: 0, failed: 0 });
                }
            });
            return;
        }
        this.isExecuting = true;
        executionsTreeProvider.clear();
        karateOutputChannel.clear();
        karateOutputChannel.append(`Executing: ${command}\n\n`, true);
        vscode.commands.executeCommand('karate-executions.focus');
        vscode.commands.executeCommand('karate-network-logs.focus');

        const location = isDebug ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification;
        const title = isDebug ? 'Karate' : '';
        vscode.window.withProgress({ location, title, cancellable: true }, async (progress, token) => {
            this.progress = progress;
            token.onCancellationRequested(() => {
                testServer.process && testServer.process.kill();
                karateOutputChannel.append('[Canceled]\n', false);
                this.onExecuting.fire({ running: false, passed: 0, failed: 0 });
            });

            // start the test process and execute callback when the port is ready
            this.startTestProcess(testServer, command, onPortReadyCallback);

            // wait for the test execution to finish
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

    private static executeOnTestProcess(port: number, command: string) {
        http.get(`http://localhost:${port}/${command.split('vscode.KarateTestProcess')[1]}`, res => {
            if (res.statusCode !== 200) {
                let errorMessage = '';
                res.on('data', chunk => (errorMessage += chunk));
                res.on('end', () => {
                    vscode.window.showErrorMessage(`Karate test server returned ${res.statusCode}\n ${errorMessage}`);
                });
            }
        });
    }

    private static startTestProcess(testServerProcess: TestServerProcess, command: string, onPortReadyCallback?: (port: number) => any) {
        // console.log('startTestProcess', command);
        this.summary = { running: true, passed: 0, failed: 0 };
        this.onExecuting.fire(this.summary);
        if (testServerProcess.process && testServerProcess.port) {
            return onPortReadyCallback && onPortReadyCallback(testServerProcess.port);
        } else {
            const argv = parseArgsStringToArgv(command);
            const child = (testServerProcess.process = spawn(argv[0], argv.splice(1), { cwd: testServerProcess.cwd }));
            child.stdout.setEncoding('utf8');
            child.stdout.on('data', data => {
                data.trim()
                    .split(/\r?\n/g)
                    // .slice(0, -1)
                    .forEach(line => {
                        if ((onPortReadyCallback && line.includes('debug server started')) || line.includes('test server started')) {
                            const port = /\d+$/.exec(line)[0];
                            testServerProcess.port = +port;
                            onPortReadyCallback(+port);
                        }
                        if (line.startsWith('##vscode {')) {
                            try {
                                const event: Event = JSON.parse(line.substring(9, line.lastIndexOf('}') + 1));
                                executionsTreeProvider.processEvent({ ...event, cwd: testServerProcess.cwd });
                                karateTestManager.processEvent({ ...event, cwd: testServerProcess.cwd });

                                if (event.event === 'featureStarted') {
                                    karateOutputChannel.startFeature(event.locationHint);
                                    this.reportProgress({ message: `${event.name}` });
                                } else if (event.event === 'testStarted') {
                                    karateOutputChannel.startScenario(event.locationHint);
                                    this.reportProgress({ message: `${getFeatureName(event)} ${event.name}` });
                                } else if (event.event === 'testOutlineStarted') {
                                    karateOutputChannel.startScenarioOutline(event.locationHint);
                                    this.reportProgress({ message: `${getFeatureName(event)} / ${event.name}` });
                                } else if (event.event === 'testFinished' || event.event === 'testFailed') {
                                    karateOutputChannel.endScenario(event.locationHint);
                                    event.event === 'testFailed' ? this.summary.failed++ : this.summary.passed++;
                                    this.onExecuting.fire(this.summary);
                                } else if (event.event === 'testOutlineFinished') {
                                    karateOutputChannel.endScenarioOutline(event.locationHint);
                                } else if (event.event === 'featureFinished') {
                                    karateOutputChannel.endFeature(event.locationHint);
                                } else if (event.event === 'testSuiteFinished') {
                                    this.isExecuting = false;
                                    this.summary.running = false;
                                    this.onExecuting.fire(this.summary);
                                } else if (event.event === 'testSuiteStarted') {
                                }
                            } catch (e) {
                                console.error('KarateExecutionProcess.on.data', line, e);
                            }
                            // karateOutputChannel.appendAll(line + '\n');
                        } else {
                            if (this.isExecuting) {
                                karateOutputChannel.appendAll(line + '\n');
                            }
                        }
                    });
            });

            child.stderr.setEncoding('utf8');
            child.stderr.on('data', data => {
                karateOutputChannel.append(data);
                if (data.includes('java.lang.ClassNotFoundException: com.intuit.karate.Main')) {
                    this.isExecuting = false;
                    karateTestManager.processEvent({ event: 'testSuiteFinished' } as any);
                    testServerProcess.cwd = testServerProcess.port = testServerProcess.process = null;

                    const message = `
NOTE: If you're seeing this message your "karateIDE.karateCli.classpath" setting is probably misconfigured.
Please, refer to https://github.com/ZenWave360/karate-ide#karate-classpath
Consider installing https://marketplace.visualstudio.com/items?itemName=KarateIDE.karate-classpath-jar
And run the "KarateIDE: Configure Classpath" command for assistance (View > Command Palette or Ctrl+Shift+P).
                    `;
                    setTimeout(() => karateOutputChannel.append(message), 100);
                }
            });

            child.on('close', code => {
                this.isExecuting = false;
                karateOutputChannel.append('.\n');
                testServerProcess.cwd = testServerProcess.port = testServerProcess.process = null;
            });
        }
    }

    private static killProcessIfDifferentCwd(process: TestServerProcess, cwd: string) {
        const env: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv');
        if (process.process && (process.cwd !== cwd || process.env !== env)) {
            process.process && process.process.kill();
            process.process = process.port = null;
        }
        process.cwd = cwd;
        process.env = env;
    }

    private static useKarateTestServer(command: string, isDebug: boolean = false) {
        const useKarateTestServer = vscode.workspace.getConfiguration('karateIDE.karateCli').get<boolean>('useKarateTestServer');
        if (isDebug && !useKarateTestServer) {
            command = command.replace('--keep-debug-server', '');
        }
        return useKarateTestServer ? command.replace('com.intuit.karate.Main', 'vscode.KarateTestProcess') : command;
    }
}

function getFeatureName(event: Event) {
    return event.locationHint.substring(event.locationHint.lastIndexOf('/') + 1, event.locationHint.lastIndexOf('.') + 1);
}

// get randrom free port
function getFreePort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const port = (server.address() as any).port;
            server.close(() => {
                resolve(port);
            });
        });
    });
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
