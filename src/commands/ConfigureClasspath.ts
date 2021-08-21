import * as vscode from 'vscode';
import * as path from 'path';

export async function configureClasspath() {
    const classpathJarExtension = vscode.extensions.getExtension('KarateIDE.karate-classpath-jar');
    const items = [
        {
            label: 'Karate.jar',
            description: 'Manual Download',
            detail: 'You need to manual download fat karate.jar. This action will promt you fro this karate.jar file location.',
            value: '',
        },
        {
            label: 'Karate 1.1.0',
            description: 'From your local maven M2_REPO',
            detail: 'Requires karate dependencies to be already present in your local maven repository.',
            value:
                '${m2.repo}/com/intuit/karate/karate-core/1.1.0/karate-core-1.1.0.jar;${m2.repo}/org/graalvm/js/js-scriptengine/21.2.0/js-scriptengine-21.2.0.jar;${m2.repo}/org/graalvm/sdk/graal-sdk/21.2.0/graal-sdk-21.2.0.jar;${m2.repo}/org/graalvm/js/js/21.2.0/js-21.2.0.jar;${m2.repo}/org/graalvm/regex/regex/21.2.0/regex-21.2.0.jar;${m2.repo}/org/graalvm/truffle/truffle-api/21.2.0/truffle-api-21.2.0.jar;${m2.repo}/com/ibm/icu/icu4j/69.1/icu4j-69.1.jar;${m2.repo}/ch/qos/logback/logback-classic/1.2.3/logback-classic-1.2.3.jar;${m2.repo}/ch/qos/logback/logback-core/1.2.3/logback-core-1.2.3.jar;${m2.repo}/org/slf4j/slf4j-api/1.7.25/slf4j-api-1.7.25.jar;${m2.repo}/org/slf4j/jcl-over-slf4j/1.7.25/jcl-over-slf4j-1.7.25.jar;${m2.repo}/com/jayway/jsonpath/json-path/2.6.0/json-path-2.6.0.jar;${m2.repo}/net/minidev/json-smart/2.4.7/json-smart-2.4.7.jar;${m2.repo}/net/minidev/accessors-smart/2.4.7/accessors-smart-2.4.7.jar;${m2.repo}/org/ow2/asm/asm/9.1/asm-9.1.jar;${m2.repo}/info/cukes/cucumber-java/1.2.5/cucumber-java-1.2.5.jar;${m2.repo}/info/cukes/cucumber-core/1.2.5/cucumber-core-1.2.5.jar;${m2.repo}/org/yaml/snakeyaml/1.29/snakeyaml-1.29.jar;${m2.repo}/de/siegmar/fastcsv/2.0.0/fastcsv-2.0.0.jar;${m2.repo}/info/picocli/picocli/4.6.1/picocli-4.6.1.jar',
        },
        {
            label: 'Karate 1.2.0.RC1',
            description: 'From your local maven M2_REPO',
            detail: 'Requires karate dependencies to be already present in your local maven repository.',
            value:
                '${m2.repo}/com/intuit/karate/karate-junit5/2.0.0/karate-junit5-2.0.0.jar;${m2.repo}/com/intuit/karate/karate-core/2.0.0/karate-core-2.0.0.jar;${m2.repo}/org/graalvm/js/js-scriptengine/21.2.0/js-scriptengine-21.2.0.jar;${m2.repo}/org/graalvm/sdk/graal-sdk/21.2.0/graal-sdk-21.2.0.jar;${m2.repo}/org/graalvm/js/js/21.2.0/js-21.2.0.jar;${m2.repo}/org/graalvm/regex/regex/21.2.0/regex-21.2.0.jar;${m2.repo}/org/graalvm/truffle/truffle-api/21.2.0/truffle-api-21.2.0.jar;${m2.repo}/com/ibm/icu/icu4j/69.1/icu4j-69.1.jar;${m2.repo}/org/thymeleaf/thymeleaf/3.0.12.RELEASE/thymeleaf-3.0.12.RELEASE.jar;${m2.repo}/ognl/ognl/3.1.26/ognl-3.1.26.jar;${m2.repo}/org/javassist/javassist/3.20.0-GA/javassist-3.20.0-GA.jar;${m2.repo}/org/attoparser/attoparser/2.0.5.RELEASE/attoparser-2.0.5.RELEASE.jar;${m2.repo}/org/unbescape/unbescape/1.1.6.RELEASE/unbescape-1.1.6.RELEASE.jar;${m2.repo}/org/slf4j/slf4j-api/1.7.25/slf4j-api-1.7.25.jar;${m2.repo}/com/linecorp/armeria/armeria/1.8.0/armeria-1.8.0.jar;${m2.repo}/com/fasterxml/jackson/core/jackson-core/2.12.3/jackson-core-2.12.3.jar;${m2.repo}/com/fasterxml/jackson/core/jackson-annotations/2.12.3/jackson-annotations-2.12.3.jar;${m2.repo}/com/fasterxml/jackson/core/jackson-databind/2.12.3/jackson-databind-2.12.3.jar;${m2.repo}/io/micrometer/micrometer-core/1.7.0/micrometer-core-1.7.0.jar;${m2.repo}/org/hdrhistogram/HdrHistogram/2.1.12/HdrHistogram-2.1.12.jar;${m2.repo}/org/latencyutils/LatencyUtils/2.0.3/LatencyUtils-2.0.3.jar;${m2.repo}/io/netty/netty-transport/4.1.63.Final/netty-transport-4.1.63.Final.jar;${m2.repo}/io/netty/netty-common/4.1.63.Final/netty-common-4.1.63.Final.jar;${m2.repo}/io/netty/netty-buffer/4.1.63.Final/netty-buffer-4.1.63.Final.jar;${m2.repo}/io/netty/netty-resolver/4.1.63.Final/netty-resolver-4.1.63.Final.jar;${m2.repo}/io/netty/netty-codec-http2/4.1.63.Final/netty-codec-http2-4.1.63.Final.jar;${m2.repo}/io/netty/netty-codec/4.1.63.Final/netty-codec-4.1.63.Final.jar;${m2.repo}/io/netty/netty-handler/4.1.63.Final/netty-handler-4.1.63.Final.jar;${m2.repo}/io/netty/netty-codec-http/4.1.63.Final/netty-codec-http-4.1.63.Final.jar;${m2.repo}/io/netty/netty-codec-haproxy/4.1.63.Final/netty-codec-haproxy-4.1.63.Final.jar;${m2.repo}/io/netty/netty-resolver-dns/4.1.63.Final/netty-resolver-dns-4.1.63.Final.jar;${m2.repo}/io/netty/netty-codec-dns/4.1.63.Final/netty-codec-dns-4.1.63.Final.jar;${m2.repo}/org/reactivestreams/reactive-streams/1.0.3/reactive-streams-1.0.3.jar;${m2.repo}/com/google/code/findbugs/jsr305/3.0.2/jsr305-3.0.2.jar;${m2.repo}/io/netty/netty-resolver-dns-native-macos/4.1.63.Final/netty-resolver-dns-native-macos-4.1.63.Final-osx-x86_64.jar;${m2.repo}/io/netty/netty-transport-native-unix-common/4.1.63.Final/netty-transport-native-unix-common-4.1.63.Final.jar;${m2.repo}/io/netty/netty-transport-native-unix-common/4.1.63.Final/netty-transport-native-unix-common-4.1.63.Final-linux-x86_64.jar;${m2.repo}/io/netty/netty-transport-native-epoll/4.1.63.Final/netty-transport-native-epoll-4.1.63.Final-linux-x86_64.jar;${m2.repo}/io/netty/netty-tcnative-boringssl-static/2.0.38.Final/netty-tcnative-boringssl-static-2.0.38.Final.jar;${m2.repo}/io/netty/netty-handler-proxy/4.1.63.Final/netty-handler-proxy-4.1.63.Final.jar;${m2.repo}/io/netty/netty-codec-socks/4.1.63.Final/netty-codec-socks-4.1.63.Final.jar;${m2.repo}/org/apache/httpcomponents/httpclient/4.5.13/httpclient-4.5.13.jar;${m2.repo}/org/apache/httpcomponents/httpcore/4.4.13/httpcore-4.4.13.jar;${m2.repo}/ch/qos/logback/logback-classic/1.2.3/logback-classic-1.2.3.jar;${m2.repo}/ch/qos/logback/logback-core/1.2.3/logback-core-1.2.3.jar;${m2.repo}/org/slf4j/jcl-over-slf4j/1.7.25/jcl-over-slf4j-1.7.25.jar;${m2.repo}/org/antlr/antlr4-runtime/4.9.2/antlr4-runtime-4.9.2.jar;${m2.repo}/com/jayway/jsonpath/json-path/2.6.0/json-path-2.6.0.jar;${m2.repo}/net/minidev/json-smart/2.4.7/json-smart-2.4.7.jar;${m2.repo}/net/minidev/accessors-smart/2.4.7/accessors-smart-2.4.7.jar;${m2.repo}/org/ow2/asm/asm/9.1/asm-9.1.jar;${m2.repo}/info/cukes/cucumber-java/1.2.5/cucumber-java-1.2.5.jar;${m2.repo}/info/cukes/cucumber-core/1.2.5/cucumber-core-1.2.5.jar;${m2.repo}/org/yaml/snakeyaml/1.29/snakeyaml-1.29.jar;${m2.repo}/de/siegmar/fastcsv/2.0.0/fastcsv-2.0.0.jar;${m2.repo}/info/picocli/picocli/4.6.1/picocli-4.6.1.jar;${m2.repo}/io/github/classgraph/classgraph/4.8.108/classgraph-4.8.108.jar;${m2.repo}/org/junit/jupiter/junit-jupiter-api/5.7.2/junit-jupiter-api-5.7.2.jar;${m2.repo}/org/apiguardian/apiguardian-api/1.1.0/apiguardian-api-1.1.0.jar;${m2.repo}/org/opentest4j/opentest4j/1.2.0/opentest4j-1.2.0.jar;${m2.repo}/org/junit/platform/junit-platform-commons/1.7.2/junit-platform-commons-1.7.2.jar;${m2.repo}/org/junit/jupiter/junit-jupiter-engine/5.7.2/junit-jupiter-engine-5.7.2.jar;${m2.repo}/org/junit/platform/junit-platform-engine/1.7.2/junit-platform-engine-1.7.2.jar',
        },
    ];
    if (classpathJarExtension) {
        items.unshift({
            label: 'KarateIDE Classpath Jar',
            description: 'Uses version provided by "KarateIDE.Classpath Jar" extension',
            detail: 'Recomended for most users',
            value: '',
        });
    }
    const answer = await vscode.window.showQuickPick(items, { canPickMany: false });
    let sep = path.delimiter;
    let classpath = `.${sep}src/test/java${sep}src/test/resources${sep}target/classes${sep}target/test-classes${sep}`;
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
            const karateJar = vscode.Uri.joinPath(vscode.Uri.file(classpathJarExtension.extensionPath), 'resources', 'karate.jar').fsPath.replace(
                /\\/g,
                '/'
            );
            classpath = classpath + karateJar;
        }
    }
    const scopeAnswer = await vscode.window.showQuickPick(['Write configuration to Global Settings', 'Write configuration to Workspace Settings'], {
        canPickMany: false,
    });

    if (scopeAnswer) {
        const scope = scopeAnswer === 'Write configuration to Global Settings';
        await vscode.workspace.getConfiguration().update('karateIDE.karateCli.classpath', classpath, scope);
        vscode.window.showInformationMessage('Your KarateIDE classpath is now configured.');
    }
}
