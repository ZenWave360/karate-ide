import {
    Execution,
    FeatureExecution,
    ScenarioExecution,
    ScenarioOutlineExecution,
    SuiteExecution,
} from '@/views/executions/KarateExecutionsTreeProvider';
import * as vscode from 'vscode';

const karateChannel = vscode.window.createOutputChannel('Karate');

class StringBuffer {
    private buffer: string = '';

    append(data: string) {
        this.buffer += data;
    }
    clear() {
        this.buffer = '';
    }
    get() {
        return this.buffer;
    }
}

export class KarateOutputChannel {
    suiteLogs = new StringBuffer();
    featuresLogsMap = new Map<string, StringBuffer>();
    scenariosLogsMap = new Map<string, StringBuffer>();
    scenarioOutlineLogsMap = new Map<string, StringBuffer>();
    featureLog: StringBuffer;
    scenarioLog: StringBuffer;
    scenarioOutlineLog: StringBuffer;

    clear() {
        this.suiteLogs.clear();
        this.featuresLogsMap.clear();
        this.scenariosLogsMap.clear();
        karateChannel.clear();
    }

    append(text: string, show: boolean = true, preserveFocus: boolean = true) {
        karateChannel.append(text);
        if (show) {
            karateChannel.show(preserveFocus);
        }
    }

    appendAll(text: string) {
        this.suiteLogs.append(text);
        this.featureLog && this.featureLog.append(text);
        this.scenarioLog && this.scenarioLog.append(text);
        this.scenarioOutlineLog && this.scenarioOutlineLog.append(text);
        karateChannel.append(text);
    }

    showOutputLogs = (execution: Execution | string, preserveFocus: boolean = true) => {
        try {
            karateChannel.clear();
            if (execution instanceof SuiteExecution) {
                karateChannel.append(this.suiteLogs.get());
            } else if (execution instanceof FeatureExecution) {
                karateChannel.append(this.featuresLogsMap.get(execution.locationHint).get());
            } else if (execution instanceof ScenarioExecution) {
                karateChannel.append(this.scenariosLogsMap.get(execution.locationHint).get());
            } else if (execution instanceof ScenarioOutlineExecution) {
                karateChannel.append(this.scenarioOutlineLogsMap.get(execution.locationHint).get());
            } else if (typeof execution === 'string') {
                karateChannel.append(execution);
            }
            karateChannel.show(preserveFocus);
        } catch (e) {
            console.error('showOutputLogs', e.message);
        }
    };

    startFeature(name) {
        this.featureLog = new StringBuffer();
        this.featuresLogsMap.set(name, this.featureLog);
    }

    startScenario(name) {
        this.scenarioLog = new StringBuffer();
        this.scenariosLogsMap.set(name, this.scenarioLog);
    }

    startScenarioOutline(name) {
        this.scenarioOutlineLog = new StringBuffer();
        this.scenarioOutlineLogsMap.set(name, this.scenarioOutlineLog);
    }

    endFeature(name) {
        this.featureLog = null;
    }

    endScenario(name) {
        this.scenarioLog = null;
    }

    endScenarioOutline(name) {
        this.scenarioOutlineLog = null;
    }
}

export const karateOutputChannel = new KarateOutputChannel();
