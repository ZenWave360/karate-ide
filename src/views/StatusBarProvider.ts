import { KarateExecutionProcess, SummaryEvent } from '@/execution/KarateExecutionProcess';
import { FeatureExecution, karateExecutionsTreeProvider, ScenarioExecution, ScenarioOutlineExecution } from '@/views/KarateExecutionsTreeProvider';
import * as vscode from 'vscode';

class StatusBarProvider {
    private statusBarItem: vscode.StatusBarItem;

    constructor(context) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
        this.statusBarItem.command = {
            command: 'karateIDE.karateExecutionsTree.runLastExecution',
            title: 'Run/Debug Last Execution',
            tooltip: 'Run/Debug Last Execution',
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

    onResultsSummary = async (e: vscode.Uri) => {
        const data = await vscode.workspace.fs.readFile(e);
        let json: any = JSON.parse(data.toString());

        this.updateSummary({ running: false, passed: json.scenariosPassed, failed: json.scenariosfailed });

        this.statusBarItem.tooltip = 'Click to replay last execution.';

        if (json.scenariosfailed > json.scenariosPassed) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentHoverBackground');
            setTimeout(() => {
                this.statusBarItem.backgroundColor = undefined;
            }, 5000);
        }
    };
}

export default StatusBarProvider;
