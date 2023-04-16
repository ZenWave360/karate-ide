import * as vscode from 'vscode';
import * as path from 'path';
let sep = path.delimiter;

export async function configureClasspath() {
    const classpathJarExtension = vscode.extensions.getExtension('KarateIDE.karate-classpath-jar');
    const items = [
        {
            label: 'Karate.jar',
            description: 'Manual Download',
            detail: 'You need to manual download fat karate.jar. This action will prompt you fro this karate.jar file location.',
            value: '',
        },
    ];
    if (classpathJarExtension) {
        items.unshift({
            label: 'KarateIDE Classpath Jar',
            description: 'Uses version provided by "KarateIDE.Classpath Jar" extension',
            detail: 'Recommended for most users',
            value: '',
        });
    }
    const answer = await vscode.window.showQuickPick(items, { canPickMany: false });
    let classpath = `src/test/java${sep}src/test/resources${sep}target/classes${sep}target/test-classes${sep}`;
    if (answer) {
        if (answer.label === 'Karate.jar') {
            const karateFile = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Select Karate.jar',
                filters: {
                    '*.jar': ['jar'],
                },
            });
            if (!karateFile) {
                return;
            }
            classpath = classpath + karateFile[0].fsPath.replace(/\\/g, '/');
        } else if (answer.label === 'KarateIDE Classpath Jar') {
            classpath = classpath + '${ext:karate-ide.jar}';
        } else {
            classpath = classpath + answer.value;
        }
    }
    const scopeAnswer = await vscode.window.showQuickPick(['Write configuration to Global Settings', 'Write configuration to Workspace Settings'], {
        canPickMany: false,
    });

    if (scopeAnswer) {
        const scope = scopeAnswer === 'Write configuration to Global Settings';
        await vscode.workspace.getConfiguration().update('karateIDE.karateCli.classpath', classpath.replace(/;/g, sep), scope);
        vscode.window.showInformationMessage('Your KarateIDE classpath is now configured.');
    }
}
