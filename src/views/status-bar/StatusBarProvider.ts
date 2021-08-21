import { KarateExecutionProcess, SummaryEvent } from '@/debug/KarateExecutionProcess';
import * as vscode from 'vscode';

class StatusBarProvider {
    private statusBarItem: vscode.StatusBarItem;

    constructor(context) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
        this.statusBarItem.command = {
            command: 'karateIDE.karateExecutionsTree.relaunchLastExecution',
            title: 'Run/Debug Last Execution',
            tooltip: 'Run/Debug Last Execution',
            arguments: [],
        };

        const resultsJsonWatcher = vscode.workspace.createFileSystemWatcher('**/karate-reports/karate-summary-json.txt');
        resultsJsonWatcher.onDidCreate(this.onResultsSummary);
        resultsJsonWatcher.onDidChange(this.onResultsSummary);

        context.subscriptions.push(this.statusBarItem);
        context.subscriptions.push(resultsJsonWatcher);

        KarateExecutionProcess.onExecuting.event(this.updateSummary);
        context.subscriptions.push(KarateExecutionProcess.onExecuting.event);

        this.updateSummary({ running: undefined, passed: 0, failed: 0 });
    }

    updateSummary = (summary: SummaryEvent) => {
        const icon = summary.running === undefined ? '' : summary.running ? '$(sync~spin)' : '$(run-all)';
        this.statusBarItem.text = `${icon} Karate $(pass) ${summary.passed} $(error) ${summary.failed}`;
        this.statusBarItem.show();
    };

    updateTooltip = tooltip => {
        this.statusBarItem.tooltip = tooltip;
    };

    onResultsSummary = async (e: vscode.Uri) => {
        console.log(e.fsPath);
        const data = await vscode.workspace.fs.readFile(e);
        let json: any = JSON.parse(data.toString());

        const features = json.featuresPassed + json.featuresFailed + json.featuresSkipped;
        const scenarios = json.scenariosPassed + json.scenariosfailed;

        const tooltip = new vscode.MarkdownString(undefined, true);
        tooltip.isTrusted = true;

        tooltip.appendMarkdown(`
Karate version: ${json.version}

======================================================

| elapsed: ${(json.elapsedTime / 1000).toFixed(2)} | threads: ${json.threads} | thread time: ${json.totalTime}  |
| features: ${features} | skipped: ${json.featuresSkipped} | efficiency: ${json.efficiency.toFixed(2)} |
| scenarios: ${scenarios} | passed: ${json.scenariosPassed} | failed: ${json.scenariosfailed} |
 
======================================================
        `);

        this.updateTooltip(tooltip);
        this.updateSummary({ running: false, passed: json.scenariosPassed, failed: json.scenariosfailed });
        // this.statusBarItem.backgroundColor =
        //     json.scenariosfailed > json.scenariosPassed ? new vscode.ThemeColor('statusBarItem.errorBackground') : undefined;
    };
}

export default StatusBarProvider;
