import ProviderBuildReports from './providerBuildReports';
import ProviderKarateTests from './providerKarateTests';
import ProviderDebugAdapter from './providerDebugAdapter';
import ProviderDebugConfiguration from './providerDebugConfiguration';
import ProviderResults from './providerResults';
import ProviderExecutions from './providerExecutions';
import ProviderStatusBar from './providerStatusBar';
import ProviderCodeLens from './providerCodeLens';
import ProviderDefinition from './providerDefinition';
import KarateNetworkLogsTreeProvider from './KarateNetworkLogsTreeProvider';
import EventLogsServer from './events-log-server/EventLogsServer';
import HoverRunDebugProvider from './HoverRunDebugProvider';
//import ProviderFoldingRange from "./providerFoldingRange";
import {
    smartPaste,
    getDebugFile,
    getDebugCommandLine,
    debugKarateTest,
    runKarateTest,
    runAllKarateTests,
    displayReportsTree,
    displayTestsTree,
    openBuildReport,
    openFileInEditor,
    launchKarateDebugExecution,
    relaunchLastKarateDebugExecution,
    debugAllKarateTests,
} from './commands';
import * as vscode from 'vscode';
import KarateExecutionsTreeProvider from './KarateExecutionsTreeProvider';
import { generateKarateTestFromOpenAPI } from './generators/openapi';

// let buildReportsTreeView = null;
// let karateTestsTreeView = null;
let buildReportsWatcher = null;
let karateTestsWatcher = null;
// let karateNetworkTreeView = null;
// let karateExecutionsTreeView = null;

export function activate(context: vscode.ExtensionContext) {
    let buildReportsProvider = new ProviderBuildReports();
    let karateTestsProvider = new ProviderKarateTests();
    let debugAdapterProvider = new ProviderDebugAdapter();
    let debugConfigurationProvider = new ProviderDebugConfiguration();
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

    registerCommand('karateRunner.paste', smartPaste);
    registerCommand('karateRunner.getDebugFile', getDebugFile);
    registerCommand('karateRunner.karateCli.getDebugCommandLine', getDebugCommandLine);
    registerCommand('karateRunner.tests.debug', debugKarateTest);
    registerCommand('karateRunner.tests.run', runKarateTest);
    registerCommand('karateRunner.tests.runAll', runAllKarateTests);
    registerCommand('karateRunner.tests.debugAll', debugAllKarateTests);
    registerCommand('karateRunner.buildReports.displayShallow', () => displayReportsTree('Shallow'));
    registerCommand('karateRunner.buildReports.displayDeep', () => displayReportsTree('Deep'));
    registerCommand('karateRunner.tests.displayShallow', () => displayTestsTree('Shallow'));
    registerCommand('karateRunner.tests.displayDeep', () => displayTestsTree('Deep'));
    registerCommand('karateRunner.buildReports.open', openBuildReport);
    registerCommand('karateRunner.buildReports.refreshTree', () => buildReportsProvider.refresh());
    registerCommand('karateRunner.tests.refreshTree', () => karateTestsProvider.refresh());
    registerCommand('karateRunner.tests.open', openFileInEditor);
    registerCommand('karateRunner.generators.openapi', generateKarateTestFromOpenAPI);

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('karate', debugAdapterProvider));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('karate', debugConfigurationProvider));
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(codeLensTarget, codeLensProvider));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(definitionTarget, definitionProvider));
    //let registerFoldingRangeProvider = vscode.languages.registerFoldingRangeProvider(foldingRangeTarget, foldingRangeProvider);

    context.subscriptions.push(vscode.window.createTreeView('karate-reports', { showCollapseAll: true, treeDataProvider: buildReportsProvider }));
    context.subscriptions.push(vscode.window.createTreeView('karate-tests', { showCollapseAll: true, treeDataProvider: karateTestsProvider }));

    context.subscriptions.push(vscode.languages.registerHoverProvider(codeLensTarget, new HoverRunDebugProvider(context)));
    // NetworkLogs View
    const networkLogsProvider = new KarateNetworkLogsTreeProvider();
    registerCommand('karateRunner.karateNetworkLogs.clearTree', () => networkLogsProvider.clear());
    registerCommand('karateRunner.karateNetworkLogs.showScenarios.true', () => networkLogsProvider.setShowScenarios(true));
    registerCommand('karateRunner.karateNetworkLogs.showScenarios.false', () => networkLogsProvider.setShowScenarios(false));
    context.subscriptions.push(vscode.window.createTreeView('karate-network-logs', { showCollapseAll: true, treeDataProvider: networkLogsProvider }));
    // Executions View
    const executionsTreeProvider = new KarateExecutionsTreeProvider();
    registerCommand('karateRunner.karateExecutionsTree.clearTree', () => executionsTreeProvider.clear());
    registerCommand('karateRunner.karateExecutionsTree.relaunchLast', relaunchLastKarateDebugExecution);
    registerCommand('karateRunner.karateExecutionsTree.launch', launchKarateDebugExecution);
    context.subscriptions.push(
        vscode.window.createTreeView('karate-executions', { showCollapseAll: false, treeDataProvider: executionsTreeProvider })
    );
    const eventLogsServer = new EventLogsServer(data => {
        networkLogsProvider.processLoggingEvent(data);
        executionsTreeProvider.processLoggingEvent(data);
    });
    const logsServerPort: number = vscode.workspace.getConfiguration('karateRunner.eventLogsServer').get('port');
    if (logsServerPort) {
        eventLogsServer.start(logsServerPort);
    }

    setupWatcher(buildReportsWatcher, String(vscode.workspace.getConfiguration('karateRunner.buildReports').get('toTarget')), buildReportsProvider);
    setupWatcher(karateTestsWatcher, String(vscode.workspace.getConfiguration('karateRunner.tests').get('toTarget')), karateTestsProvider);

    vscode.workspace.onDidChangeConfiguration(e => {
        let buildReportsDisplayType = e.affectsConfiguration('karateRunner.buildReports.activityBarDisplayType');
        let buildReportsToTarget = e.affectsConfiguration('karateRunner.buildReports.toTarget');

        if (buildReportsDisplayType) {
            buildReportsProvider.refresh();
        }

        if (buildReportsToTarget) {
            try {
                buildReportsWatcher.dispose();
            } catch (e) {
                // do nothing
            }

            setupWatcher(
                buildReportsWatcher,
                String(vscode.workspace.getConfiguration('karateRunner.buildReports').get('toTarget')),
                buildReportsProvider
            );
        }

        let karateTestsDisplayType = e.affectsConfiguration('karateRunner.tests.activityBarDisplayType');
        let karateTestsToTarget = e.affectsConfiguration('karateRunner.tests.toTarget');

        if (karateTestsDisplayType) {
            karateTestsProvider.refresh();
        }

        if (karateTestsToTarget) {
            try {
                karateTestsWatcher.dispose();
            } catch (e) {
                // do nothing
            }

            setupWatcher(karateTestsWatcher, String(vscode.workspace.getConfiguration('karateRunner.tests').get('toTarget')), karateTestsProvider);
        }

        const port: number = vscode.workspace.getConfiguration('karateRunner.eventLogsServer').get('port');
        if (eventLogsServer.port !== port) {
            eventLogsServer.stop();
            if (port) {
                eventLogsServer.start(port);
            }
        }
    });

    // context.subscriptions.push(refreshTestsTreeCommand);
    // context.subscriptions.push(openFileCommand);
    // context.subscriptions.push(registerDebugAdapterProvider);
    // context.subscriptions.push(registerDebugConfigurationProvider);
    // context.subscriptions.push(registerCodeLensProvider);
    // context.subscriptions.push(registerDefinitionProvider);
    // context.subscriptions.push(resultsProvider);
    // //context.subscriptions.push(registerFoldingRangeProvider);
    // context.subscriptions.push(registerHoverRunDebugProvider);
    // context.subscriptions.push(clearExecutionsTreeCommand);
    // context.subscriptions.push(karateExecutionsTreeView);
    // context.subscriptions.push(karateNetworkTreeView);
    // context.subscriptions.push(clearNetworkLogsTreeCommand);
    // context.subscriptions.push(showScenariosCommand);
    // context.subscriptions.push(dontShowScenariosCommand);
    // context.subscriptions.push(relaunchLastCommand);
    // context.subscriptions.push(launchExecutionCommand);
}

export function deactivate() {
    // buildReportsTreeView.dispose();
    // karateTestsTreeView.dispose();
    buildReportsWatcher.dispose();
    karateTestsWatcher.dispose();
    // karateNetworkTreeView.dispose();
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
