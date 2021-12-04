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
        {
            label: 'Karate 1.1.0',
            description: 'From your local maven M2_REPO',
            detail: 'Requires karate dependencies to be already present in your local maven repository.',
            value:
                '${m2.repo}/com/intuit/karate/karate-core/1.1.0/karate-core-1.1.0.jar;${m2.repo}/org/graalvm/js/js-scriptengine/21.2.0/js-scriptengine-21.2.0.jar;${m2.repo}/org/graalvm/sdk/graal-sdk/21.2.0/graal-sdk-21.2.0.jar;${m2.repo}/org/graalvm/js/js/21.2.0/js-21.2.0.jar;${m2.repo}/org/graalvm/regex/regex/21.2.0/regex-21.2.0.jar;${m2.repo}/org/graalvm/truffle/truffle-api/21.2.0/truffle-api-21.2.0.jar;${m2.repo}/com/ibm/icu/icu4j/69.1/icu4j-69.1.jar;${m2.repo}/ch/qos/logback/logback-classic/1.2.3/logback-classic-1.2.3.jar;${m2.repo}/ch/qos/logback/logback-core/1.2.3/logback-core-1.2.3.jar;${m2.repo}/org/slf4j/slf4j-api/1.7.25/slf4j-api-1.7.25.jar;${m2.repo}/org/slf4j/jcl-over-slf4j/1.7.25/jcl-over-slf4j-1.7.25.jar;${m2.repo}/com/jayway/jsonpath/json-path/2.6.0/json-path-2.6.0.jar;${m2.repo}/net/minidev/json-smart/2.4.7/json-smart-2.4.7.jar;${m2.repo}/net/minidev/accessors-smart/2.4.7/accessors-smart-2.4.7.jar;${m2.repo}/org/ow2/asm/asm/9.1/asm-9.1.jar;${m2.repo}/info/cukes/cucumber-java/1.2.5/cucumber-java-1.2.5.jar;${m2.repo}/info/cukes/cucumber-core/1.2.5/cucumber-core-1.2.5.jar;${m2.repo}/org/yaml/snakeyaml/1.29/snakeyaml-1.29.jar;${m2.repo}/de/siegmar/fastcsv/2.0.0/fastcsv-2.0.0.jar;${m2.repo}/info/picocli/picocli/4.6.1/picocli-4.6.1.jar',
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
        }
        if (answer.label === 'Karate 1.1.0') {
            classpath = classpath + answer.value;
        }
        if (answer.label === 'KarateIDE Classpath Jar') {
            classpath = classpath + '${ext:karate-ide.jar}';
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
