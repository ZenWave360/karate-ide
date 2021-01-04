import * as vscode from 'vscode';
import * as path from 'path';
import { Headers, ITreeEntry, LoggingEventVO, NetworkLog, NetworkRequestResponseLog, Payload, PayloadProperty, ThreadTreeEntry, TreeEntry } from './model/KarateEventLogsModels';

export default class KarateNetworkLogsTreeProvider implements vscode.TreeDataProvider<ITreeEntry> {
    private eventLogsTree: { [key: string]: ThreadTreeEntry } = {};
    private showScenarios = false;

    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    public clear(): any {
        this.eventLogsTree = {};
        this._onDidChangeTreeData.fire();
    }

    public setShowScenarios(showScenarios) {
        this.showScenarios = showScenarios;
        this._onDidChangeTreeData.fire();
    }

    public processLoggingEvent(data: Buffer) {
        data.toString()
            .split('\n')
            .forEach(log => {
                const json = JSON.parse(log);
                this.addITreeEntry(json);
            });
    }
    
    addITreeEntry(event: LoggingEventVO): any {
        // console.log('event', event.eventType, event.feature, event.scenario, event.url)
        const threadName = event.thread;
        const threadTree = this.eventLogsTree[threadName] || new ThreadTreeEntry(threadName);
        this.eventLogsTree[threadName] = threadTree;
        if (event.eventType.endsWith('_START')) {
            const parent = threadTree.stack[threadTree.stack.length-1] || threadTree;
            threadTree.stack.push(new TreeEntry(parent as TreeEntry, event))
        }
        else if (event.eventType.endsWith('_END')) {
            const parent = threadTree.stack.pop() as TreeEntry;
            parent.eventEnd = event;
        }
        else if (event.eventType === 'REQUEST') {
            const parent = threadTree.stack[threadTree.stack.length - 1] || threadTree;
            const request = new NetworkLog('Request', new Headers(event.headers), new Payload(event.payload));
            const httpLog = new NetworkRequestResponseLog(parent as TreeEntry, event, request);
            threadTree.stack.push(httpLog);
            threadTree.httpLogs.push(httpLog);
        }
        else if (event.eventType === 'RESPONSE') {
            const parent = threadTree.stack.pop() as NetworkRequestResponseLog;
            const response = new NetworkLog('Response', new Headers(event.headers), new Payload(event.payload));
            parent.status = event.status;
            parent.response = response;
            parent.eventEnd = event;
            parent.children.push(response);
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ITreeEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const item = element.asTreeItem();
        if (item instanceof vscode.TreeItem) {
            return item;
        }
        const treeItem = new vscode.TreeItem(item.label, item.state);
        if (item.iconPath) {
            treeItem.iconPath =	{
				light: path.join(__dirname, '..', 'resources', 'light', item.iconPath),
				dark: path.join(__dirname, '..', 'resources', 'dark', item.iconPath)
			}
        }
        if (item.command) {
            treeItem.command = item.command;
        }
        if (element instanceof TreeEntry) {
            treeItem.contextValue = element.eventStart.eventType
        }

        return treeItem;
    }
    getChildren(element?: ITreeEntry): vscode.ProviderResult<ITreeEntry[]> {
        if (!element) {
            return Object.values(this.eventLogsTree);
        } else if (element instanceof NetworkRequestResponseLog) {
            return [element.request, element.response];
        } else if (element instanceof NetworkLog) {
            return [element.headers, element.payload];
        } else if (element instanceof Headers) {
            return element.headers;
        } else if (element instanceof Payload || element instanceof PayloadProperty) {
            return element.properties;
        } else if (element instanceof TreeEntry) {
            if (this.showScenarios) {
                return element.children;
            } else {
                return (element as ThreadTreeEntry).httpLogs;
            }
        }
        return null;
    }
}
