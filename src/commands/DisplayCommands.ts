import * as vscode from 'vscode';
import { LocalStorageService } from './LocalStorageService';

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
    var position = new vscode.Position(line, 0);
    vscode.window.showTextDocument(uri).then(editor => {
        editor.selections = [new vscode.Selection(position, position)];
        editor.revealRange(new vscode.Range(position, position));
    });
}
