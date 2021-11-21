import * as vscode from 'vscode';
import Icons from '@/Icons';
import { Event } from '@/execution/KarateExecutionProcess';

export class SuiteExecution {
    constructor(public readonly name) {}
}
export class FeatureExecution {
    public eventEnd: Event | undefined;
    public scenarioExecutions: (ScenarioExecution | ScenarioOutlineExecution)[] = [];
    public errors: string[] = [];
    constructor(public eventStart: Event) {}

    get name() {
        return this.eventStart.name;
    }

    get locationHint() {
        return this.eventStart.locationHint;
    }
}

export class ScenarioOutlineExecution {
    public eventEnd: Event | undefined;
    public scenarioExecutions: ScenarioExecution[] = [];
    public errors: string[] = [];
    constructor(public eventStart: Event, public parent: FeatureExecution) {}

    get name() {
        return this.eventStart.name;
    }

    get locationHint() {
        return this.eventStart.locationHint;
    }
}

export class ScenarioExecution {
    public eventEnd: Event | undefined;
    public errors: string[] = [];
    constructor(public eventStart: Event) {}

    get name() {
        return this.eventStart.name;
    }

    get locationHint() {
        return this.eventStart.locationHint;
    }
}

export type Execution = SuiteExecution | FeatureExecution | ScenarioOutlineExecution | ScenarioExecution;

class KarateExecutionsTreeProvider implements vscode.TreeDataProvider<Execution> {
    public executions: FeatureExecution[] = [];
    private auxParentFeatureOrOutline: ScenarioOutlineExecution | FeatureExecution = undefined;

    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    private treeView: vscode.TreeView<Execution>;

    public setTreeView(treeView: vscode.TreeView<Execution>) {
        this.treeView = treeView;
        this.configureViewTitle();
    }

    public clear(): any {
        this.executions = [];
        this.auxParentFeatureOrOutline = undefined;
        this._onDidChangeTreeData.fire(null);
    }

    public refresh = () => {
        this._onDidChangeTreeData.fire(null);
    };

    async switchKarateEnv() {
        let karateEnv = String(vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv'));
        karateEnv = await vscode.window.showInputBox({ prompt: 'Karate Env', value: karateEnv });
        if (karateEnv !== undefined) {
            await vscode.workspace.getConfiguration().update('karateIDE.karateCli.karateEnv', karateEnv);
            this.configureViewTitle();
        }
    }

    async karateOptions() {
        let karateOptions = String(vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateOptions'));
        karateOptions = await vscode.window.showInputBox({ prompt: 'Karate Options', value: karateOptions });
        if (karateOptions !== undefined) {
            await vscode.workspace.getConfiguration().update('karateIDE.karateCli.karateOptions', karateOptions);
            this.configureViewTitle();
        }
    }

    private configureViewTitle() {
        const karateEnv = String(vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateEnv'));
        const karateOptions = String(vscode.workspace.getConfiguration('karateIDE.karateCli').get('karateOptions'));
        this.treeView.description = `Karate Env: '${karateEnv}', Karate Options: '${karateOptions}'`;
    }

    processEvent(event: Event): any {
        if (event.event === 'featureStarted') {
            this.executions.push((this.auxParentFeatureOrOutline = new FeatureExecution(event)));
        } else if (event.event === 'featureFinished') {
            this.auxParentFeatureOrOutline.eventEnd = event;
        } else if (event.event === 'testOutlineStarted') {
            const outline = new ScenarioOutlineExecution(event, this.auxParentFeatureOrOutline);
            this.auxParentFeatureOrOutline.scenarioExecutions.push(outline);
            this.auxParentFeatureOrOutline = outline;
        } else if (event.event === 'testStarted') {
            this.auxParentFeatureOrOutline.scenarioExecutions.push(new ScenarioExecution(event));
        } else if (event.event === 'testFinished' || event.event === 'testFailed') {
            const parent = this.auxParentFeatureOrOutline;
            const scenarioExecution = parent.scenarioExecutions[parent.scenarioExecutions.length - 1];
            scenarioExecution.eventEnd = event;
            if (event.event === 'testFailed') {
                scenarioExecution.errors.push(`${event.message}: ${event.details}`);
                parent.errors.push(`${event.message}: ${event.details}`);
                if (parent instanceof ScenarioOutlineExecution) {
                    parent.parent.errors.push(`${event.message}: ${event.details}`);
                }
            }
        } else if (event.event === 'testOutlineFinished') {
            this.auxParentFeatureOrOutline.eventEnd = event;
            this.auxParentFeatureOrOutline = (this.auxParentFeatureOrOutline as ScenarioOutlineExecution).parent;
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
            if (execution.errors.length) {
                // treeItem.tooltip = execution.errors.join('\n');
            }
        } else if (execution instanceof ScenarioOutlineExecution) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            treeItem.contextValue = 'ScenarioOutlineExecution';
            treeItem.iconPath = execution.eventEnd ? (execution.errors.length ? Icons.error : Icons.pass) : Icons.loading;
            if (execution.errors.length) {
                // treeItem.tooltip = execution.errors.join('\n');
            }
        } else if (execution instanceof ScenarioExecution) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = 'ScenarioExecution';
            treeItem.iconPath = execution.eventEnd ? (execution.eventEnd.event === 'testFailed' ? Icons.error : Icons.pass) : Icons.loading;
            if (execution.eventEnd?.message) {
                treeItem.tooltip = `${execution.eventEnd.message}:\n ${execution.eventEnd.details}`;
            }
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
        } else if (element instanceof FeatureExecution || element instanceof ScenarioOutlineExecution) {
            return element.scenarioExecutions;
        }
        return null;
    }
}

export const karateExecutionsTreeProvider = new KarateExecutionsTreeProvider();
