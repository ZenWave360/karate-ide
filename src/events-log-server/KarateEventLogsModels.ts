import Icons from '../Icons';
import * as vscode from 'vscode';

export class LoggingEventVO {
    timestamp: number;
    eventType: string;
    thread: string;

    rootFeature: string;
    rootScenario: string;

    currentDir: string;
    feature: string;
    scenario: string;
    outline: boolean;
    line: number;
    name: string;
    resource: string;
    caller: string;
    callDepth: number;

    method: string;
    url: string;
    status: string;
    headers: { [key: string]: string };
    payload: string;
}

export interface ITreeEntry {
    asTreeItem(): vscode.TreeItem | ITreeEntryCommand;
}

export class ITreeEntryCommand {
    label: string;
    state?: vscode.TreeItemCollapsibleState;
    command?: vscode.Command;
    iconPath?: vscode.ThemeIcon;
}

export class TreeEntry implements ITreeEntry {
    parent: TreeEntry;
    children: ITreeEntry[] = [];
    eventStart: LoggingEventVO;
    eventEnd: LoggingEventVO;

    __arg: string;

    constructor(parent: TreeEntry, eventStart: LoggingEventVO) {
        this.parent = parent;
        this.eventStart = eventStart;
        if (parent && parent.children) {
            parent.children.push(this);
            if (eventStart.eventType === 'SCENARIO_START' && eventStart.payload) {
                // this.children.push(new Payload(eventStart.payload, '__arg'))
                this.__arg = eventStart.payload;
            }
        }
    }

    asTreeItem(): vscode.TreeItem | ITreeEntryCommand {
        const eventType = this.eventStart.eventType;
        let label = '';
        let state =
            this.parent && this.parent.eventStart && this.parent.eventStart.eventType === 'FEATURE_START'
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;
        if (eventType === 'FEATURE_START') {
            label = 'Feature: ' + this.eventStart.resource;
        }
        if (eventType === 'SCENARIO_START') {
            label = 'Scenario';
            if (this.eventStart.outline) {
                label = 'Scenario Outline';
                state = vscode.TreeItemCollapsibleState.Collapsed;
            }
            label = label + ':' + this.eventStart.scenario;
        }
        return {
            label,
            state,
            iconPath: Icons.karateTest,
        };
        // return new vscode.TreeItem(`${label}`, state);
    }
}

export class ThreadTreeEntry extends TreeEntry {
    stack: ITreeEntry[] = [];
    rootFeatures: TreeEntry[] = [];
    httpLogs: NetworkRequestResponseLog[] = [];

    constructor(public threadName: string) {
        super(null, null);
    }

    asTreeItem() {
        const treeItem = new vscode.TreeItem(`Thread: ${this.threadName}`, vscode.TreeItemCollapsibleState.Expanded);
        treeItem.contextValue = 'ThreadTreeEntry';
        return treeItem;
    }
}

export class NetworkRequestResponseLog extends TreeEntry {
    method: string;
    url: string;
    status = 'pending';
    request: NetworkLog;
    response: NetworkLog;

    constructor(parent: TreeEntry, eventStart: LoggingEventVO, request: NetworkLog) {
        super(parent, eventStart);
        this.url = eventStart.url;
        this.method = eventStart.method;
        this.request = request;
        this.children.push(this.request);
    }

    asTreeItem() {
        const treeItem = new vscode.TreeItem(`${this.method} ${this.url} (${this.status})`, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'NetworkRequestResponseLog';
        return treeItem;
    }
}

export class NetworkLog implements ITreeEntry {
    constructor(private label: 'Request' | 'Response', public headers: Headers, public payload: Payload | null) {}

    asTreeItem() {
        const treeItem = new vscode.TreeItem(`${this.label}:`, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'NetworkLog';
        return treeItem;
    }
}

export class Headers implements ITreeEntry {
    next: null;
    headers: Header[] = [];
    constructor(headers: { [key: string]: string }) {
        this.headers = Object.entries(headers).map(([key, value]) => new Header(key, value));
    }
    asTreeItem() {
        const treeItem = new vscode.TreeItem(`Headers:`, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'Headers';
        return treeItem;
    }
}

export class Header implements ITreeEntry {
    next: null;
    constructor(public key: string, public value: string) {}
    asTreeItem() {
        const treeItem = new vscode.TreeItem(`${this.key}: ${this.value}`);
        treeItem.contextValue = 'Header';
        return treeItem;
    }
}

export class Payload implements ITreeEntry {
    properties: PayloadProperty[];
    constructor(public payload: string, private label = 'Payload') {
        try {
            const json = JSON.parse(payload);
            if (json) {
                this.properties = Object.entries(json).map(([key, value]) => new PayloadProperty(key, value));
            }
        } catch (e) {
            console.log(e);
        }
    }
    asTreeItem() {
        const treeItem = new vscode.TreeItem(`${this.label}:`, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.tooltip = this.payload;
        treeItem.description = this.payload;
        treeItem.contextValue = 'Payload';
        return treeItem;
    }
}

export class PayloadProperty implements ITreeEntry {
    next: null;
    properties: PayloadProperty[];
    constructor(public key: string, public value: any) {
        try {
            if (typeof value === 'object') {
                this.properties = Object.entries(value).map(([nestedKey, nestedValue]) => new PayloadProperty(nestedKey, nestedValue));
            }
        } catch (e) {
            console.log(e);
        }
    }
    asTreeItem() {
        const treeItem =
            this.properties && this.properties.length
                ? new vscode.TreeItem(`${this.key}:`, vscode.TreeItemCollapsibleState.Collapsed)
                : new vscode.TreeItem(`${this.key}: ${this.value}`, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = 'PayloadProperty';
        return treeItem;
    }
}
