import * as vscode from 'vscode';
import { getFileAndRootPath } from '@/feature';
import { getCommandLine, getKarateOptions } from './CommandUtils';
import { KarateExecutionProcess } from './KarateExecutionProcess';
import { getDebugFile } from './KarateTestsManager';

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
        const debugCommandLine = await getCommandLine('DEBUG');
        const { root: projectRootPath } = getFileAndRootPath(vscode.Uri.file(featureFile));

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(); //reject(new Error('Timeout while waiting for debug adapter'));
            }, 10000);
            KarateExecutionProcess.executeInDebugServer(projectRootPath, debugCommandLine, port => {
                clearTimeout(timeout);
                resolve(new vscode.DebugAdapterServer(port));
            });
        });
    }
}

export default ProviderDebugAdapter;
