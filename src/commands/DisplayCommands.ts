import { FeatureExecution, ScenarioExecution, ScenarioOutlineExecution } from '@/views/KarateExecutionsTreeProvider';
// import { KarateTestTreeEntry } from '@/fs/FilesManager';
import * as path from 'path';
import * as vscode from 'vscode';

export function openFileInEditor(uri, line = 1) {
    if (uri instanceof FeatureExecution || uri instanceof ScenarioExecution || uri instanceof ScenarioOutlineExecution) {
        const [feature, _line] = uri.eventStart.locationHint.split(':');
        line = +_line - 1;
        uri = vscode.Uri.file(path.join(uri.eventStart.cwd, feature));
    }
    var position = new vscode.Position(line, 0);
    vscode.window.showTextDocument(uri).then(editor => {
        editor.selections = [new vscode.Selection(position, position)];
        editor.revealRange(new vscode.Range(position, position));
    });
}
