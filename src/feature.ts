import * as vscode from 'vscode';

export class Feature {
    tags: string[];
    title: string;
    scenarios: Scenario[] = [];
}

export class Scenario {
    tags: string[];
    title: string;
    line: number;
    examples: Example[] = [];
}

export class Example {
    tags: string[];
    title: string;
    line: number;
}

export async function parseFeature(uri: vscode.Uri): Promise<Feature> {
    let document = await vscode.workspace.openTextDocument(uri);

    let feature: Feature = null;
    let outline: Scenario = null;
    let tags: string[] = [];
    for (let line = 0; line < document.lineCount; line++) {
        let lineText = document.lineAt(line).text.trim();
        if (lineText.startsWith('@')) {
            tags = [...tags, ...lineText.split(/\s+/).map(t => t.trim())];
        } else if (lineText.startsWith('Feature:')) {
            feature = new Feature();
            feature.tags = tags;
            feature.title = lineText.trim();
            tags = [];
        } else if (lineText.startsWith('Scenario:') || lineText.startsWith('Scenario Outline:')) {
            const scenario = new Scenario();
            scenario.line = line + 1;
            scenario.tags = tags;
            scenario.title = lineText.trim();
            feature.scenarios.push(scenario);
            tags = [];
            if (lineText.startsWith('Scenario Outline:')) {
                outline = scenario;
            }
        } else if (lineText.startsWith('Examples:')) {
            let exampleIndex = 1;
            for (line = line + 2; line < document.lineCount; line++) {
                lineText = document.lineAt(line).text.trim();
                if (lineText === '') {
                    continue;
                } else if (lineText.startsWith('|')) {
                    const example = new Example();
                    example.line = line + 1;
                    example.tags = tags;
                    example.title = `[${exampleIndex++}] ` + lineText.replace(/\s+/g, ' ');
                    outline.examples.push(example);
                } else if (lineText === '') {
                    continue;
                } else {
                    // TODO lookahead if is a new Examples
                    line = line - 1;
                    tags = [];
                    break;
                }
            }
        }
    }

    return feature;
}
