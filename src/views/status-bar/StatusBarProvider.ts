import { KarateExecutionProcess, SummaryEvent } from '@/execution/KarateExecutionProcess';
import { Feature } from '@/models/feature';
import {
    FeatureExecution,
    karateExecutionsTreeProvider,
    ScenarioExecution,
    ScenarioOutlineExecution,
} from '@/views/executions/KarateExecutionsTreeProvider';
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
        this.statusBarItem.show();
    };

    onResultsSummary = async (e: vscode.Uri) => {
        const data = await vscode.workspace.fs.readFile(e);
        let json: any = JSON.parse(data.toString());

        const features = json.featuresPassed + json.featuresFailed + json.featuresSkipped;
        const scenarios = json.scenariosPassed + json.scenariosfailed;

        const tooltip = new vscode.MarkdownString(undefined, true);
        tooltip.isTrusted = true;

        tooltip.appendMarkdown(`
### Karate version: ${json.version}

Elapsed time: ${json.elapsedTime}

|               | Passed | Failed | Skipped |
| ------------- | -----: | -----: | ------: |
| **Feature**   | ${json.featuresPassed}  | ${json.featuresFailed} | ${json.featuresSkipped} |
| **Scenarios** | ${json.scenariosPassed} | ${json.scenariosfailed} |  |

        `);

        const executions: (FeatureExecution | ScenarioOutlineExecution | ScenarioExecution)[] = karateExecutionsTreeProvider.executions.slice();
        karateExecutionsTreeProvider.executions.forEach(e => {
            executions.push(e);
            e.scenarioExecutions.forEach(s => {
                executions.push(s);
                if (s instanceof ScenarioOutlineExecution) {
                    s.scenarioExecutions.forEach(o => {
                        executions.push(o);
                    });
                }
            });
        });

        tooltip.appendMarkdown('\n\n=========\n\n');

        const allFailedScenarios = executions
            .filter(e => e.errors && e instanceof ScenarioExecution && e.eventStart.dynamic !== true)
            .map(e => vscode.Uri.joinPath(vscode.Uri.file(e.eventStart.cwd), e.eventStart.locationHint).fsPath)
            .join(';');
        if (allFailedScenarios.length > 0) {
            const allFailedArgs = encodeURIComponent(JSON.stringify([allFailedScenarios]));
            const allFailedRow =
                `| [Run](command:karateIDE.tests.run?${allFailedArgs} "Karate: Run") ` +
                `| [Debug](command:karateIDE.tests.debug?${allFailedArgs} "Karate: Debug") ` +
                `| All failed Scenarios |\n`;

            tooltip.appendMarkdown(
                executions.reduce<string>((list, value: FeatureExecution | ScenarioOutlineExecution | ScenarioExecution) => {
                    const failed = value.eventEnd.message === null;
                    if (value.errors && value.eventStart.dynamic !== true) {
                        // FIXME:  && !value.eventStart.dynamic
                        const uri = vscode.Uri.joinPath(vscode.Uri.file(value.eventStart.cwd), value.eventStart.locationHint.replace(/:1(;|$)/, ''));
                        const args = encodeURIComponent(JSON.stringify([uri.fsPath]));
                        const executionType =
                            value instanceof FeatureExecution ? 'Feature' : value instanceof ScenarioOutlineExecution ? 'Outline' : 'Scenario';
                        list =
                            list +
                            `| [Run](command:karateIDE.tests.run?${args} "Karate: Run") ` +
                            `| [Debug](command:karateIDE.tests.debug?${args} "Karate: Debug") ` +
                            `| ${executionType}: ${value.eventStart.locationHint} |\n`;
                    }
                    return list;
                }, `\n| Run | Debug | Feature/Scenario |\n| --- | --- | --- |\n `) // append when ready ${allFailedRow}
            );
        }

        tooltip.appendMarkdown('\n\n(click status bar to re-run last execution)');

        this.updateTooltip(tooltip);
        this.updateSummary({ running: false, passed: json.scenariosPassed, failed: json.scenariosfailed });

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
