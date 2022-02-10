import DefinitionProvider from '@/completion/DefinitionProvider';
import { openFileInEditor } from '@/commands/DisplayCommands';
import { LocalStorageService } from '@/commands/LocalStorageService';
import { smartPaste } from '@/commands/SmartPaste';
import ProviderDebugAdapter from '@/execution/ProviderDebugAdapter';
import { generateKarateTestFromOpenAPI } from '@/generators/openapi/OpenAPIGenerator';
import EventLogsServer from '@/server/EventLogsServer';
import { karateExecutionsTreeProvider, debugTestEntry, runTestEntry } from '@/views/KarateExecutionsTreeProvider';
import KarateNetworkLogsTreeProvider from '@/views/KarateNetworkLogsTreeProvider';
import StatusBarProvider from '@/views/StatusBarProvider';
import { URL } from 'url';
import * as vscode from 'vscode';
import { CompletionItemProvider } from './completion/CompletionProvider';
import { configureClasspath } from './commands/ConfigureClasspath';
import { KarateExecutionProcess } from './execution/KarateExecutionProcess';
import { karateOutputChannel } from './execution/KarateOutputChannel';
import { disposables, relaunchTest } from './execution/KarateTestsManager';
import { filesManager } from './fs/FilesManager';
import { generateBusinessFlowTest } from './generators/openapi/OpenAPIBusinessFlowGenerator';
import { generateKarateMocksFromOpenAPI, generateKarateMockValidation } from './generators/openapi/OpenAPIMocksGenerator';
import { NetworkLog, NetworkRequestResponseLog, PayloadProperty } from './server/KarateEventLogsModels';
import { generateKarateProject } from './generators/karate-project/KarateProjectGenerator';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(...disposables);
    let debugAdapterProvider = new ProviderDebugAdapter();
    let statusBarProvider = new StatusBarProvider(context);

    let karateFile = { language: 'karate', scheme: 'file' };

    function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any) {
        context.subscriptions.push(vscode.commands.registerCommand(command, callback));
    }

    function createTreeView(viewId: string, options: vscode.TreeViewOptions<any>) {
        const treeView = vscode.window.createTreeView(viewId, options);
        context.subscriptions.push(treeView);
        if (typeof options.treeDataProvider['setTreeView'] === 'function') {
            options.treeDataProvider['setTreeView'](treeView);
        }
        return treeView;
    }

    LocalStorageService.initialize(context.workspaceState);

    registerCommand('karateIDE.paste', smartPaste);
    registerCommand('karateIDE.karateExecutionsTree.open', openFileInEditor);
    registerCommand('karateIDE.karateExecutionsTree.switchKarateEnv', () => karateExecutionsTreeProvider.switchKarateEnv());
    registerCommand('karateIDE.karateExecutionsTree.karateOptions', () => karateExecutionsTreeProvider.karateOptions());
    registerCommand('karateIDE.karateExecutionsTree.mockServerOptions', () => karateExecutionsTreeProvider.mockServerOptions());
    registerCommand('karateIDE.karateExecutionsTree.refresh', () => filesManager.loadFiles());
    registerCommand('karateIDE.generators.openapi.test', generateKarateTestFromOpenAPI);
    registerCommand('karateIDE.generators.openapi.mocks', generateKarateMocksFromOpenAPI);
    registerCommand('karateIDE.generators.openapi.mocks-validation', generateKarateMockValidation);
    registerCommand('karateIDE.generators.openapi.businessFlowTest', generateBusinessFlowTest);
    registerCommand('karateIDE.configureClasspath', configureClasspath);
    registerCommand('karateIDE.generateKarateProject', generateKarateProject);
    registerCommand('karateIDE.karateNetworkLogs.copyAsPayload', (item: vscode.TreeItem | any) => {
        if (item.value) {
            vscode.env.clipboard.writeText(JSON.stringify(item.value, null, 2));
        } else if (item.label) {
            vscode.env.clipboard.writeText(item.label.toString());
        }
    });
    registerCommand('karateIDE.karateNetworkLogs.copyAsPath', (item: PayloadProperty) => {
        const jsonPath = item?.jsonPath();
        if (jsonPath) {
            vscode.env.clipboard.writeText(jsonPath.replace(/^\$\./g, ''));
        }
    });
    registerCommand('karateIDE.karateNetworkLogs.copyAsCURL', (item: NetworkLog | NetworkRequestResponseLog) => {
        const httplog: NetworkRequestResponseLog = item instanceof NetworkLog ? item.parent : item;
        const request = httplog.request;
        const headers = request.headers.headers.map(h => `-H "${h.key}: ${h.value}"`);
        const payload = request.payload.payload ? `-d '${request.payload.payload}'` : '';
        const template = `curl --request ${httplog.method} ${headers.join(' ')} '${httplog.url}' ${payload}`;
        vscode.env.clipboard.writeText(template);
        vscode.window.showInformationMessage('Copied to clipboard');
    });
    registerCommand('karateIDE.karateNetworkLogs.copyAsKarateMock', (item: NetworkRequestResponseLog | NetworkLog) => {
        try {
            item = item instanceof NetworkLog ? item.parent : item;
            const mock = `Scenario:  methodIs('${item.method}') && pathMatches('${new URL(item.url).pathname}')
* def response = '${JSON.stringify(item.response.payload.json)}'
* def responseStatus = ${item.status}\n`;

            vscode.env.clipboard.writeText(mock);
        } catch (e) {
            vscode.window.showErrorMessage(e.message);
        }
    });
    registerCommand('karateIDE.showNetworkRequestResponseLog', (payload, description) => {
        payload = payload && typeof payload === 'object' ? JSON.stringify(payload, null, 2) : payload + '';
        karateOutputChannel.showOutputLogs(`// ${description || ''}\n${payload || ''}`);
    });

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('karate-ide', debugAdapterProvider));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('karate-ide', debugAdapterProvider));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(karateFile, new DefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(karateFile, new CompletionItemProvider(), ...["'", '"']));

    // NetworkLogs View
    const networkLogsProvider = new KarateNetworkLogsTreeProvider();
    registerCommand('karateIDE.karateNetworkLogs.clearTree', () => networkLogsProvider.clear());
    registerCommand('karateIDE.karateNetworkLogs.showScenarios.true', () => networkLogsProvider.setShowScenarios(true));
    registerCommand('karateIDE.karateNetworkLogs.showScenarios.false', () => networkLogsProvider.setShowScenarios(false));
    createTreeView('karate-network-logs', { showCollapseAll: true, treeDataProvider: networkLogsProvider });
    // Executions View
    registerCommand('karateIDE.karateExecutionsTree.run', runTestEntry);
    registerCommand('karateIDE.karateExecutionsTree.debug', debugTestEntry);
    registerCommand('karateIDE.karateExecutionsTree.runAll', () => relaunchTest('RUN'));
    registerCommand('karateIDE.karateExecutionsTree.debugAll', () => relaunchTest('DEBUG'));
    registerCommand('karateIDE.karateExecutionsTree.runLastExecution', () => relaunchTest());
    registerCommand('karateIDE.karateExecutionsTree.showOutputLogs', karateOutputChannel.showOutputLogs);
    registerCommand('karateIDE.karateExecutionsProcess.stopTestProcesses', () => KarateExecutionProcess.stopTestProcesses());
    createTreeView('karate-executions', { showCollapseAll: false, treeDataProvider: karateExecutionsTreeProvider });
    const eventLogsServer = new EventLogsServer(data => {
        try {
            networkLogsProvider.processLoggingEvent(data);
        } catch (e) {
            console.error('ERROR networkLogsProvider.processLoggingEvent', data, e);
        }
    });
    eventLogsServer.start();

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('karateIDE.tests.globFilter')) {
            filesManager.loadFiles();
        }
    });
}

export function deactivate() {}
