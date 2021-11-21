import { debugKarateTest, runKarateTest } from '@/commands/RunDebug';
import { filesManager, KarateTestTreeEntry } from '@/fs/FilesManager';
import { getTestExecutionDetail, ITestExecutionDetail } from '@/helper';
import * as vscode from 'vscode';
import { Event } from './KarateExecutionProcess';

const controller = vscode.tests.createTestController('karate', 'Karate Tests');
const testItems = new Map<string, vscode.TestItem>();

export function reloadKarateTestsController() {
    testItems.clear();
    const karateFiles = filesManager.getKarateFiles();
    function addTestItems(karateTestEntries: KarateTestTreeEntry[], parent: vscode.TestItemCollection) {
        karateTestEntries.forEach(async element => {
            if (element.type === vscode.FileType.Directory) {
                const folder = controller.createTestItem(element.uri.fsPath, element.title, element.uri);
                parent.add(folder);
                addTestItems(element.children, folder.children);
            } else if (element.type === vscode.FileType.File && element.uri.fsPath.endsWith('.feature')) {
                const line = element.feature.line || 0;
                const lineUri = line > 0 ? ':' + line : '';
                const feature = controller.createTestItem(`${element.uri.fsPath}${lineUri}`, element.title, element.uri);
                feature.range = new vscode.Range(line, 0, line + 1, 0);
                feature.canResolveChildren = true;
                let tedArray: ITestExecutionDetail[] = await getTestExecutionDetail(feature.uri);
                tedArray.forEach(ted => {
                    if (ted.testLine > 0) {
                        const scenario = controller.createTestItem(`${feature.uri.fsPath}:${ted.testLine}`, ted.testTitle, feature.uri);
                        scenario.range = new vscode.Range(ted.testLine - 1, 0, ted.testLine, 0);
                        scenario.tags = (ted.testTag || '')
                            .split(/\s+/)
                            .filter(tag => tag !== '')
                            .map(tag => new vscode.TestTag(tag));
                        feature.children.add(scenario);
                        testItems.set(scenario.id, scenario);
                    } else {
                        feature.tags = (ted.testTag || '')
                            .split(/\s+/)
                            .filter(tag => tag !== '')
                            .map(tag => new vscode.TestTag(tag));
                    }
                });
                if (feature.children.size > 0) {
                    // TODO filter @ignore and @mock
                    parent.add(feature);
                    testItems.set(feature.id, feature);
                }
            }
        });
    }
    addTestItems(karateFiles, controller.items);
    console.log('Karate tests reloaded', controller.items);
}

let testRunner: vscode.TestRun | undefined;
function runHandler(shouldDebug: boolean, request: vscode.TestRunRequest, token: vscode.CancellationToken) {
    testRunner = controller.createTestRun(request);
    const command = shouldDebug ? debugKarateTest : runKarateTest;
    const testFeature = request.include.map(t => t.id).join(';');
    command(testFeature, null);
}

let featureErrors = [];
let outlineErrors = [];
export function processEvent(event: Event): void {
    if (event.event === 'testSuiteStarted') {
    } else if (event.event === 'featureStarted') {
        featureErrors = [];
        // testRunner.started(findTestItem(event.cwd, event.locationHint));
    } else if (event.event === 'featureFinished') {
        // if (featureErrors.length > 0) {
        //     testRunner.failed(findTestItem(event.cwd, event.locationHint), featureErrors);
        // } else {
        //     testRunner.passed(findTestItem(event.cwd, event.locationHint), event.duration);
        // }
    } else if (event.event === 'testOutlineStarted') {
        outlineErrors = [];
        testRunner.started(findTestItem(event.cwd, event.locationHint));
    } else if (event.event === 'testStarted' && !event.outline) {
        const item = findTestItem(event.cwd, event.locationHint);
        testRunner.started(item);
    } else if (event.event === 'testFinished' && !event.outline) {
        const item = findTestItem(event.cwd, event.locationHint);
        testRunner.passed(item, event.duration);
    } else if (event.event === 'testFailed' && !event.outline) {
        const errorMessage = new vscode.TestMessage(`${event.message}: ${event.details}`);
        featureErrors.push(errorMessage);
        outlineErrors.push(errorMessage);
        testRunner.failed(findTestItem(event.cwd, event.locationHint), errorMessage);
    } else if (event.event === 'testOutlineFinished') {
        if (outlineErrors.length > 0) {
            testRunner.failed(findTestItem(event.cwd, event.locationHint), outlineErrors);
        } else {
            testRunner.passed(findTestItem(event.cwd, event.locationHint), event.duration);
        }
    } else if (event.event === 'testSuiteFinished') {
        testRunner.end();
    }
}

function findTestItem(cwd: string, locationHint: string): vscode.TestItem | undefined {
    const uri = vscode.Uri.joinPath(vscode.Uri.file(cwd), locationHint.replace(/:1$/, ''));
    const testItem = testItems.get(uri.fsPath);
    return testItem;
}

const runProfile = controller.createRunProfile('Run Karate', vscode.TestRunProfileKind.Run, (request, token) => {
    runHandler(false, request, token);
});

const debugProfile = controller.createRunProfile('Debug Karate', vscode.TestRunProfileKind.Debug, (request, token) => {
    runHandler(true, request, token);
});
