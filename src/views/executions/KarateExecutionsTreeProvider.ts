import * as vscode from 'vscode';
import * as path from 'path';
import { ITreeEntry, ITreeEntryCommand, LoggingEventVO, ThreadTreeEntry, TreeEntry } from '@/server/KarateEventLogsModels';
import Icons from '@/Icons';

export default class KarateExecutionsTreeProvider implements vscode.TreeDataProvider<ITreeEntry> {
    private eventLogsTree: { [key: string]: ThreadTreeEntry } = {};

    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    public clear(): any {
        this.eventLogsTree = {};
        this._onDidChangeTreeData.fire(null);
    }

    public setShowScenarios(showScenarios) {
        this._onDidChangeTreeData.fire(null);
    }

    public processLoggingEvent(event: LoggingEventVO) {
        this.addITreeEntry(event);
    }

    addITreeEntry(event: LoggingEventVO): any {
        // console.log('event', event.eventType, event.callDepth, event.feature, event.scenario, event.url)
        if (event.callDepth >= 1) {
            return;
        }
        const threadName = event.thread;
        const threadTree = this.eventLogsTree[threadName] || new ThreadTreeEntry(threadName);
        this.eventLogsTree[threadName] = threadTree;
        if (event.eventType === 'FEATURE_START') {
            threadTree.rootFeatures.push(new TreeEntry(threadTree as TreeEntry, event));
        } else if (event.eventType === 'FEATURE_END') {
            const feature = threadTree.rootFeatures[threadTree.rootFeatures.length - 1];
            feature.eventEnd = event;
        } else if (event.eventType === 'SCENARIO_START') {
            const feature = threadTree.rootFeatures[threadTree.rootFeatures.length - 1];
            new TreeEntry(feature as TreeEntry, event); // this already does feature.children.push
        } else if (event.eventType === 'SCENARIO_END') {
            const feature = threadTree.rootFeatures[threadTree.rootFeatures.length - 1];
            const scenario = feature.children[feature.children.length - 1] as TreeEntry;
            scenario.eventEnd = event;
        }
        this._onDidChangeTreeData.fire(null);
    }

    getTreeItem(entry: TreeEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (!entry.eventStart) {
            return entry.asTreeItem();
        }
        const asTreeItem = entry.asTreeItem() as ITreeEntryCommand;
        const state = entry.eventStart.eventType === 'FEATURE_START' ? vscode.TreeItemCollapsibleState.Expanded : asTreeItem.state;
        const treeItem = new vscode.TreeItem(asTreeItem.label, state);

        // console.log('getTreeItem', entry.eventStart.eventType, entry.eventEnd)
        treeItem.iconPath = entry.eventEnd ? (entry.eventEnd.status === 'OK' ? Icons.pass : Icons.error) : Icons.loading;
        treeItem.contextValue = entry.eventStart.eventType;
        return treeItem;
    }
    getChildren(element?: ITreeEntry): vscode.ProviderResult<ITreeEntry[]> {
        if (!element) {
            const threads = Object.values(this.eventLogsTree);
            return threads.length === 1 ? threads[0].children : threads;
        } else if (element instanceof TreeEntry) {
            return element.children;
        }
        return null;
    }
}
