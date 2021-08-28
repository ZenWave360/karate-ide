import * as net from 'net';
import { getFileAndRootPath } from '@/helper';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getDebugCommandLine, getDebugFile, getKarateOptions } from '@/commands/RunDebug';
import { KarateExecutionProcess } from './KarateExecutionProcess';
import { domainToASCII } from 'url';

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
        const debugCommandLine = await getDebugCommandLine();
        const { root: projectRootPath } = getFileAndRootPath(vscode.Uri.file(featureFile));

        return new Promise((resolve, reject) => {
            KarateExecutionProcess.execute(projectRootPath, debugCommandLine, port => {
                resolve(new vscode.DebugAdapterServer(port));
            });
        });
    }
}

export default ProviderDebugAdapter;
