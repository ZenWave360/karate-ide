import * as vscode from 'vscode';
import { ITreeEntry, ITreeEntryCommand, LoggingEventVO, ThreadTreeEntry, TreeEntry } from '@/server/KarateEventLogsModels';
import Icons from '@/Icons';
import { Event } from '@/debug/KarateExecutionProcess';

export class SuiteExecution {
    constructor(public readonly name) {}
}
export class FeatureExecution {
    public eventEnd: Event | undefined;
    public scenarioExecutions: ScenarioExecution[] = [];
    public errors: string[] = [];
    constructor(public eventStart: Event) {}

    get name() {
        return this.eventStart.name;
    }
}

export class ScenarioExecution {
    public eventEnd: Event | undefined;
    constructor(public eventStart: Event) {}

    get name() {
        return this.eventStart.name;
    }
}

export type Execution = SuiteExecution | FeatureExecution | ScenarioExecution;

class KarateExecutionsTreeProvider implements vscode.TreeDataProvider<Execution> {
    private executions: FeatureExecution[] = [];

    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    public clear(): any {
        this.executions = [];
        this._onDidChangeTreeData.fire(null);
    }

    processEvent(event: Event): any {
        console.log('event', event);
        if (event.event === 'featureStarted') {
            this.executions.push(new FeatureExecution(event));
        } else if (event.event === 'featureFinished') {
            this.executions[this.executions.length - 1].eventEnd = event;
        } else if (event.event === 'testStarted') {
            this.executions[this.executions.length - 1].scenarioExecutions.push(new ScenarioExecution(event));
        } else if (event.event === 'testFinished' || event.event === 'testFailed') {
            const featureExecution = this.executions[this.executions.length - 1];
            const scenarioExecution = featureExecution.scenarioExecutions[featureExecution.scenarioExecutions.length - 1];
            scenarioExecution.eventEnd = event;
            if (event.event === 'testFailed') {
                featureExecution.errors.push(`${event.message}: ${event.details}`);
            }
        }
        this._onDidChangeTreeData.fire(null);
    }

    getTreeItem(execution: Execution): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(execution.name, vscode.TreeItemCollapsibleState.Expanded);
        if (execution instanceof SuiteExecution) {
            treeItem.contextValue = 'SuiteExecution';
        } else if (execution instanceof FeatureExecution) {
            treeItem.contextValue = 'FeatureExecution';
            treeItem.iconPath = execution.eventEnd ? (execution.errors.length ? Icons.error : Icons.pass) : Icons.loading;
        } else if (execution instanceof ScenarioExecution) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = 'ScenarioExecution';
            treeItem.iconPath = execution.eventEnd ? (execution.eventEnd.message ? Icons.error : Icons.pass) : Icons.loading;
        }
        treeItem.command = {
            command: 'karateIDE.karateExecutionsTree.showOutputLogs',
            title: '',
            arguments: [execution],
        };
        return treeItem;
    }
    getChildren(element?: Execution): vscode.ProviderResult<Execution[]> {
        if (!element) {
            return this.executions?.length ? [new SuiteExecution('Karate Tests')] : null;
        } else if (element instanceof SuiteExecution) {
            return this.executions;
        } else if (element instanceof FeatureExecution) {
            return element.scenarioExecutions;
        }
        return null;
    }
}

export const karateExecutionsTreeProvider = new KarateExecutionsTreeProvider();
