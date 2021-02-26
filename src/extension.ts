import KarateTestsProvider from '@/views/tests/KarateTestsProvider';
import ProviderDebugAdapter from '@/debug/ProviderDebugAdapter';
import ProviderResults from '@/views/status-bar/providerResults';
import ProviderExecutions from '@/views/status-bar/providerExecutions';
import ProviderStatusBar from '@/views/status-bar/providerStatusBar';
import ProviderCodeLens from '@/codelens/providerCodeLens';
import ProviderDefinition from '@/codelens/providerDefinition';
import KarateNetworkLogsTreeProvider from '@/views/logs/KarateNetworkLogsTreeProvider';
import EventLogsServer from '@/server/EventLogsServer';
import HoverRunDebugProvider from '@/codelens/HoverRunDebugProvider';
//import ProviderFoldingRange from "./providerFoldingRange";
import {
    runKarateTest,
    debugKarateTest,
    runAllKarateTests,
    debugAllKarateTests,
    relaunchDebugAll,
    relaunchRunAll,
    relaunchDebug,
    relaunchRun,
} from '@/commands/RunDebug';
import { openFileInEditor } from '@/commands/DisplayCommands';
import { smartPaste } from '@/commands/SmartPaste';

import * as vscode from 'vscode';
import KarateExecutionsTreeProvider from '@/views/executions/KarateExecutionsTreeProvider';
import { generateKarateTestFromOpenAPI, generateKarateMocksFromOpenAPI } from '@/generators/openapi/OpenAPIGenerator';
import { LocalStorageService } from '@/commands/LocalStorageService';

let karateTestsWatcher = null;

export function activate(context: vscode.ExtensionContext) {
    let karateTestsProvider = new KarateTestsProvider();
    let debugAdapterProvider = new ProviderDebugAdapter();
    let resultsProvider = new ProviderResults();
    let executionsProvider = new ProviderExecutions();
    let statusBarProvider = new ProviderStatusBar(context);
    let codeLensProvider = new ProviderCodeLens();
    let definitionProvider = new ProviderDefinition();
    //let foldingRangeProvider = new ProviderFoldingRange();

    let codeLensTarget = { language: 'karate', scheme: 'file' };
    let definitionTarget = { language: 'karate', scheme: 'file' };
    //let foldingRangeTarget = { language: "karate", scheme: "file" };

    function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any) {
        context.subscriptions.push(vscode.commands.registerCommand(command, callback));
    }

    LocalStorageService.initialize(context.workspaceState);

    registerCommand('karateIDE.paste', smartPaste);
    registerCommand('karateIDE.tests.debug', debugKarateTest);
    registerCommand('karateIDE.tests.run', runKarateTest);
    registerCommand('karateIDE.tests.runAll', runAllKarateTests);
    registerCommand('karateIDE.tests.debugAll', debugAllKarateTests);
    registerCommand('karateIDE.tests.refreshTree', () => karateTestsProvider.refresh());
    registerCommand('karateIDE.tests.switchKarateEnv', () => karateTestsProvider.switchKarateEnv());
    registerCommand('karateIDE.tests.configureFocus', () => karateTestsProvider.configureTestsFocus());
    registerCommand('karateIDE.tests.open', openFileInEditor);
    registerCommand('karateIDE.generators.openapi.test', generateKarateTestFromOpenAPI);
    registerCommand('karateIDE.generators.openapi.mocks', generateKarateMocksFromOpenAPI);

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('karate-ide', debugAdapterProvider));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('karate-ide', debugAdapterProvider));
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(codeLensTarget, codeLensProvider));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(definitionTarget, definitionProvider));
    //let registerFoldingRangeProvider = vscode.languages.registerFoldingRangeProvider(foldingRangeTarget, foldingRangeProvider);

    context.subscriptions.push(vscode.window.createTreeView('karate-tests', { showCollapseAll: true, treeDataProvider: karateTestsProvider }));

    context.subscriptions.push(vscode.languages.registerHoverProvider(codeLensTarget, new HoverRunDebugProvider(context)));
    // NetworkLogs View
    const networkLogsProvider = new KarateNetworkLogsTreeProvider();
    registerCommand('karateIDE.karateNetworkLogs.clearTree', () => networkLogsProvider.clear());
    registerCommand('karateIDE.karateNetworkLogs.showScenarios.true', () => networkLogsProvider.setShowScenarios(true));
    registerCommand('karateIDE.karateNetworkLogs.showScenarios.false', () => networkLogsProvider.setShowScenarios(false));
    context.subscriptions.push(vscode.window.createTreeView('karate-network-logs', { showCollapseAll: true, treeDataProvider: networkLogsProvider }));
    // Executions View
    const executionsTreeProvider = new KarateExecutionsTreeProvider();
    registerCommand('karateIDE.karateExecutionsTree.clearTree', () => executionsTreeProvider.clear());
    registerCommand('karateIDE.karateExecutionsTree.relaunchDebugAll', relaunchDebugAll);
    registerCommand('karateIDE.karateExecutionsTree.relaunchDebug', relaunchDebug);
    registerCommand('karateIDE.karateExecutionsTree.relaunchRunAll', relaunchRunAll);
    registerCommand('karateIDE.karateExecutionsTree.relaunchRun', relaunchRun);
    context.subscriptions.push(
        vscode.window.createTreeView('karate-executions', { showCollapseAll: false, treeDataProvider: executionsTreeProvider })
    );
    const eventLogsServer = new EventLogsServer(data => {
        networkLogsProvider.processLoggingEvent(data);
        executionsTreeProvider.processLoggingEvent(data);
    });
    eventLogsServer.start();

    setupWatcher(karateTestsWatcher, String(vscode.workspace.getConfiguration('karateIDE.tests').get('globFilter')), karateTestsProvider);

    vscode.workspace.onDidChangeConfiguration(e => {
        let karateTestsGlobFilter = e.affectsConfiguration('karateIDE.tests.globFilter');
        if (karateTestsGlobFilter) {
            try {
                karateTestsWatcher.dispose();
            } catch (e) {
                // do nothing
            }

            setupWatcher(karateTestsWatcher, String(vscode.workspace.getConfiguration('karateIDE.tests').get('globFilter')), karateTestsProvider);
        }
    });
}

export function deactivate() {
    karateTestsWatcher.dispose();
}

function setupWatcher(watcher, watcherGlob, provider) {
    watcher = vscode.workspace.createFileSystemWatcher(watcherGlob);

    watcher.onDidCreate(e => {
        provider.refresh();
    });
    watcher.onDidChange(e => {
        provider.refresh();
    });
    watcher.onDidDelete(e => {
        provider.refresh();
    });

    provider.refresh();
}
