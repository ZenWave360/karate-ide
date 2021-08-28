import { FeatureExecution, ScenarioExecution } from '@/views/executions/KarateExecutionsTreeProvider';
import { KarateTestTreeEntry } from '@/fs/FilesManager';
import * as path from 'path';
import * as vscode from 'vscode';

export function openFileInEditor(uri, line = 1) {
    if (uri instanceof FeatureExecution || uri instanceof ScenarioExecution) {
        let workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
        const [feature, _line] = uri.eventStart.locationHint.split(':');
        line = +_line - 1;
        uri = vscode.Uri.file(path.join(uri.eventStart.cwd, feature));
    } else if (uri instanceof KarateTestTreeEntry) {
        line = uri.feature.line - 1;
        uri = uri.uri;
    }
    var position = new vscode.Position(line, 0);
    vscode.window.showTextDocument(uri).then(editor => {
        editor.selections = [new vscode.Selection(position, position)];
        editor.revealRange(new vscode.Range(position, position));
    });
}
