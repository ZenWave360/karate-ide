import { getFileAndRootPath } from '../helper';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getDebugCommandLine, getDebugFile, getKarateOptions } from '../commands/RunDebug';

const KARATE_START_TIMEOUT = 60;
const DEFAULT_CONFIG = {
    type: 'karate-ide',
    name: 'Karate IDE (debug)',
    request: 'launch',
};

class ProviderDebugAdapter implements vscode.DebugAdapterDescriptorFactory, vscode.DebugConfigurationProvider {
    provideDebugConfigurations(
        folder: vscode.WorkspaceFolder | undefined,
        token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        // auto-fill new launch.json with default config
        return Promise.resolve([DEFAULT_CONFIG]);
    }

    async resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration> {
        if (!config.type && !config.request && !config.name) {
            // open debug configurations/launch.json if non-existent
            return null;
        }
        config.feature = getDebugFile();
        config.karateOptions = getKarateOptions();
        return config;
    }

    async createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined
    ): Promise<vscode.ProviderResult<vscode.DebugAdapterDescriptor>> {
        const featureFile = getDebugFile();
        const debugCommandLine = getDebugCommandLine();
        const { root: projectRootPath } = getFileAndRootPath(vscode.Uri.file(featureFile));

        let relativePattern = new vscode.RelativePattern(projectRootPath, '**/karate-debug-port.txt');
        let watcher = vscode.workspace.createFileSystemWatcher(relativePattern);
        let debugCanceledByUser = false;
        let debugPortFile = null;

        let getDebugPort = (task: vscode.TaskExecution) => {
            return new Promise<number>((resolve, reject) => {
                vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Waiting for debug server to start...',
                        cancellable: true,
                    },
                    async (progress, token) => {
                        token.onCancellationRequested(() => {
                            debugCanceledByUser = true;
                        });

                        let incrementer = 100 / KARATE_START_TIMEOUT;

                        progress.report({ increment: incrementer });

                        await new Promise((resolve, reject) => {
                            let interval = setInterval(() => {
                                if (debugCanceledByUser) {
                                    clearInterval(interval);
                                    clearTimeout(timeout);
                                    task.terminate();
                                    reject(new Error('Aborting debugger.  Canceled by user.'));
                                }

                                if (debugPortFile !== null) {
                                    clearInterval(interval);
                                    clearTimeout(timeout);
                                    let port = fs.readFileSync(debugPortFile.fsPath, { encoding: 'utf8' });
                                    console.log(`debug server ready on port: ${port}`);

                                    resolve(parseInt(port));
                                } else {
                                    progress.report({ increment: incrementer });
                                }
                            }, 1000);

                            let timeout = setTimeout(() => {
                                clearInterval(interval);
                                task.terminate();
                                reject(new Error('Aborting debugger.  Timed out waiting for debug server to start.'));
                            }, KARATE_START_TIMEOUT * 1000);
                        }).then(
                            port => resolve(Number(port)),
                            error => reject(error)
                        );
                    }
                );
            });
        };

        watcher.onDidCreate(e => {
            watcher.dispose();
            debugPortFile = e;
        });

        watcher.onDidChange(e => {
            watcher.dispose();
            debugPortFile = e;
        });

        let seo: vscode.ShellExecutionOptions = { cwd: projectRootPath };
        let exec = new vscode.ShellExecution(debugCommandLine, seo);
        let task = new vscode.Task({ type: 'karate-ide' }, vscode.TaskScope.Workspace, 'Karate Debug', 'karate-ide', exec, []);

        return vscode.tasks
            .executeTask(task)
            .then(task => getDebugPort(task))
            .then(port => new vscode.DebugAdapterServer(port));
    }
}

export default ProviderDebugAdapter;
