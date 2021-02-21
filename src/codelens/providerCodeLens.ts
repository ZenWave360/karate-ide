import { getTestExecutionDetail, ITestExecutionDetail } from '@/helper';
import * as path from 'path';
import * as vscode from 'vscode';

class ProviderCodeLens implements vscode.CodeLensProvider {
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        let codeLensArray = [];
        let tedArray: ITestExecutionDetail[] = await getTestExecutionDetail(document.uri, vscode.FileType.File);

        tedArray.forEach(ted => {
            let codeLensLocation = new vscode.Range(ted.codelensLine, 0, ted.codelensLine, 0);
            let codeLensRunCommand: vscode.Command = {
                arguments: [ted.testFeature, ted.testLine],
                command: 'karateIDE.tests.run',
                title: 'Karate: Run',
            };
            let codeLensDebugCommand: vscode.Command = {
                arguments: [ted.testFeature, ted.testLine],
                command: 'karateIDE.tests.debug',
                title: 'Karate: Debug',
            };

            codeLensArray.push(new vscode.CodeLens(codeLensLocation, codeLensRunCommand));
            codeLensArray.push(new vscode.CodeLens(codeLensLocation, codeLensDebugCommand));
        });

        return codeLensArray;
    }
}

export default ProviderCodeLens;
