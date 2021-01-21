import { TreeEntry } from '../events-log-server/KarateEventLogsModels';
import { KarateTestTreeEntry } from '../providerKarateTests';
import * as path from 'path';
import * as vscode from 'vscode';

export function displayReportsTree(displayType) {
    vscode.workspace.getConfiguration().update('karateRunner.buildReports.activityBarDisplayType', displayType);
}

export function displayTestsTree(displayType) {
    vscode.workspace.getConfiguration().update('karateRunner.tests.activityBarDisplayType', displayType);
}

export function openBuildReport(reportUri) {
    vscode.env.openExternal(reportUri);
}

export function openFileInEditor(uri, line = 1) {
    if (uri instanceof TreeEntry) {
        let workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
        line = uri.eventStart.line;
        uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, uri.eventStart.resource));
    } else if (uri instanceof KarateTestTreeEntry) {
        line = uri.feature.line;
        uri = uri.uri;
    }
    var position = new vscode.Position(line, 0);
    vscode.window.showTextDocument(uri).then(editor => {
        editor.selections = [new vscode.Selection(position, position)];
        editor.revealRange(new vscode.Range(position, position));
    });
}
