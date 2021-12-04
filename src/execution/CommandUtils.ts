import * as path from 'path';
import { getFileAndRootPath } from '@/helper';
import * as vscode from 'vscode';
import EventLogsServer from '@/server/EventLogsServer';
import { KarateExecutionProcess } from '@/execution/KarateExecutionProcess';
import { Execution, SuiteExecution } from '@/views/executions/KarateExecutionsTreeProvider';

function processClasspath(classpath: string, jar: 'vscode.jar' | 'apimock.jar' = 'vscode.jar') {
    if (classpath.includes('${m2.repo}')) {
        const m2Repo: string =
            vscode.workspace.getConfiguration('karateIDE.karateCli').get('m2Repo') ||
            (process.env.M2_REPO && process.env.M2_REPO) ||
            (process.env.HOME && path.join(process.env.HOME, '.m2/repository')) ||
            (process.env.UserProfile && path.join(process.env.UserProfile, '.m2/repository'));
        if (m2Repo) {
            classpath = classpath.replace(/\${m2\.repo}/g, m2Repo);
        }
    }
    if (classpath.includes('${ext:karate-ide.jar}')) {
        const classpathJarExtension = vscode.extensions.getExtension('KarateIDE.karate-classpath-jar');
        if (classpathJarExtension) {
            const karateJar = vscode.Uri.joinPath(vscode.Uri.file(classpathJarExtension.extensionPath), 'resources', 'karate.jar').fsPath.replace(
                /\\/g,
                '/'
            );
            classpath = classpath.replace(/\${ext\:karate-ide\.jar}/g, karateJar);
        }
    }
    if (Boolean(vscode.workspace.getConfiguration('karateIDE.karateCli').get('addHookToClasspath'))) {
        return path.join(__dirname, `../resources/${jar}`) + path.delimiter + classpath;
    }
    return classpath;
}

export async function getStartMockCommandLine(openapi: string, feature: string) {
    const classpath: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('classpath');
    const mockServerOptions: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('mockServerOptions');
    let debugCommandTemplate: string = vscode.workspace.getConfiguration('karateIDE.karateCli').get('mockServerCommandTemplate');

    if (debugCommandTemplate.includes('${port}')) {
        debugCommandTemplate = debugCommandTemplate.replace('${port}', await vscode.window.showInputBox({ prompt: 'Mock Server Port', value: '0' }));
    }

    return debugCommandTemplate
        .replace('${classpath}', processClasspath(classpath, 'apimock.jar'))
        .replace('${mockServerOptions}', mockServerOptions)
        .replace('${openapi}', openapi || '')
        .replace('${feature}', feature || '');
}

export async function startMockServer(featureFiles: vscode.Uri[], controller: vscode.TestController, token: vscode.CancellationToken) {
    // console.log('startMockServer', arguments);
    const openapi = featureFiles.map(f => f.fsPath.replace(/\\/g, '/')).filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
    const features = featureFiles.map(f => f.fsPath.replace(/\\/g, '/')).filter(f => f.endsWith('.feature'));
    const command = await getStartMockCommandLine(openapi[0], features.join(','));
    let exec = new vscode.ShellExecution(command, {});
    let task = new vscode.Task({ type: 'karate' }, vscode.TaskScope.Workspace, 'Karate Mock Server', 'karate', exec, []);
    vscode.tasks.executeTask(task);
}
