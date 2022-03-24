import Icons from '@/Icons';
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
    isDinamic: boolean;
    line: number;
    name: string;
    resource: string;
    caller: string;
    callDepth: number;

    method: string;
    url: string;
    status: string;
    failureMessage: string;
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
        let state = vscode.TreeItemCollapsibleState.Collapsed;
        if (eventType === 'FEATURE_START') {
            label = 'Feature: ' + this.eventStart.resource;
            state = vscode.TreeItemCollapsibleState.Expanded;
        }
        if (eventType === 'SCENARIO_START') {
            label = 'Scenario';
            if (this.eventStart.outline) {
                label = 'Scenario Outline';
            }
            label = label + ': ' + this.eventStart.scenario;
            state = vscode.TreeItemCollapsibleState.Collapsed;
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
        const treeItem = new vscode.TreeItem(`Karate Suite: ${this.threadName}`, vscode.TreeItemCollapsibleState.Expanded);
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
        if (this.response) {
            treeItem.command = {
                command: 'karateIDE.showNetworkRequestResponseLog',
                title: '',
                arguments: [this.response.payload.json || this.response.payload.text, `Response ${this.method} ${this.url} (${this.status})`],
            };
        }
        return treeItem;
    }
}

export class NetworkLog implements ITreeEntry {
    public parent: NetworkRequestResponseLog;
    constructor(private label: 'Request' | 'Response', public headers: Headers, public payload: Payload | null) {
        headers.parent = this;
        payload.parent = this;
    }

    description() {
        return `${this.label} ${this.parent.method} ${this.parent.url} (${this.parent.status})`;
    }

    asTreeItem() {
        const treeItem = new vscode.TreeItem(`${this.label}:`, vscode.TreeItemCollapsibleState.Collapsed);
        if (this.label === 'Response') {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        treeItem.contextValue = 'NetworkLog' + this.label;
        if (this.payload) {
            treeItem.command = {
                command: 'karateIDE.showNetworkRequestResponseLog',
                title: '',
                arguments: [this.payload.json || this.payload.text, this.description()],
            };
        }
        return treeItem;
    }
}

export class Headers implements ITreeEntry {
    parent: NetworkLog;
    headers: Header[] = [];
    constructor(headers: { [key: string]: string }) {
        this.headers = Object.entries(headers).map(([key, value]) => new Header(key, value));
    }
    description() {
        return this.headers.map(h => `${h.key}: ${h.value}`).join('\n');
    }
    asTreeItem() {
        const treeItem = new vscode.TreeItem(`Headers:`, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'NetworkLogHeaders';
        treeItem.command = {
            command: 'karateIDE.showNetworkRequestResponseLog',
            title: '',
            arguments: [this.description(), `Headers for ${this.parent.description()}`],
        };
        return treeItem;
    }
}

export class Header implements ITreeEntry {
    next: null;
    constructor(public key: string, public value: string) {}
    asTreeItem() {
        const treeItem = new vscode.TreeItem(`${this.key}: ${this.value}`);
        treeItem.contextValue = 'NetworkLogHeader';
        treeItem.command = {
            command: 'karateIDE.showNetworkRequestResponseLog',
            title: '',
            arguments: [`${this.key}: ${this.value}`, 'header'],
        };
        return treeItem;
    }
}

export class Payload implements ITreeEntry {
    parent: NetworkLog;
    json: any;
    text: string;
    properties: PayloadProperty[];
    constructor(public payload: string, private label = 'Payload') {
        try {
            this.json = JSON.parse(payload);
            if (this.json) {
                this.properties = Object.entries(this.json).map(([key, value]) => new PayloadProperty(key, value, this));
            }
        } catch (e) {
            this.text = payload;
        }
    }

    jsonPath() {
        return '$';
    }

    asTreeItem() {
        const treeItem = new vscode.TreeItem(`${this.label}:`, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.tooltip = JSON.stringify(this.payload, null, 2);
        treeItem.description = this.json ? this.payload : undefined;
        treeItem.contextValue = 'NetworkLogPayload';
        treeItem.command = {
            command: 'karateIDE.showNetworkRequestResponseLog',
            title: '',
            arguments: [this.json || this.text, `Payload for ${this.parent.description()}`],
        };
        return treeItem;
    }
}

export class PayloadProperty implements ITreeEntry {
    properties: PayloadProperty[];
    constructor(public key: string, public value: any, public parent: Payload | PayloadProperty) {
        try {
            if (typeof value === 'object') {
                this.properties = Object.entries(value || {}).map(([nestedKey, nestedValue]) => new PayloadProperty(nestedKey, nestedValue, this));
            }
        } catch (e) {
            console.error(e);
        }
    }

    jsonPath() {
        const parentPath = this.parent.jsonPath();
        const thisPath = /^[0-9]+$/.test(this.key) ? `[${this.key}]` : this.key;
        const separator = thisPath.startsWith('[') ? '' : '.';
        return parentPath + separator + thisPath;
    }

    asTreeItem() {
        const treeItem =
            this.properties && this.properties.length
                ? new vscode.TreeItem(`${this.key}:`, vscode.TreeItemCollapsibleState.Collapsed)
                : new vscode.TreeItem(`${this.key}: ${this.value}`, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = 'NetworkLogPayloadProperty';
        treeItem.description = typeof this.value === 'object' ? JSON.stringify(this.value) : undefined;
        treeItem.tooltip = JSON.stringify(this.value, null, 2);
        treeItem.command = {
            command: 'karateIDE.showNetworkRequestResponseLog',
            title: '',
            arguments: [this.value, `${this.jsonPath()}`],
        };
        return treeItem;
    }
}
