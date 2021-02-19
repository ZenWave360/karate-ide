# Karate IDE

Explore your APIs and Debug [Karate](https://github.com/intuit/karate) test scripts within VS Code.

> :warning: **Beta**: This is an unfinished and beta extension.

## Debug Karate Scripts

You can Debug [Karate](https://github.com/intuit/karate) scripts, using:

-   set breakpoints
-   step-by-step debuging
-   navigate scenario call stack with their variables
-   inspect and copy variables, values or their json path expression
-   interactive debug console where you can print, update variable values or test jsonPath expressions
-   hot reloading (with caveants)

It uses the DebugAdapter originaly developed by [Peter Thomas] (https://github.com/intuit/karate/) and [Kirk Slota] (https://github.com/kirksl/karate-runner/).

https://twitter.com/KarateDSL/status/1167533484560142336

## Explore your APIs

Now you can also explore your API from within VS Code. Karate is (one of) the best API testing automation tools.

With this extension you can leverage your existing scripts to explore your API while you develop your test scripts. No need to maintain a separate collection or switch between different programs.

You can also use this extension to generate reusable tests scripts from OpenAPI and cURL to speed up your development and api exploration.

![Karate-IDE](resources/screenshots/Karate-IDE.png)

### Structured HTTP Log Viewer

Forget about reading response payload from text log files.

### Generating Code from OpenAPI definitions

If you want to quickly test/explore and you have an openapi definition you can generate
You can generate reusable karate scenarios from you openapi definitions, with test data yml files.

![alt](resources/screenshots/Generate-Karate-Test.png)
![alt](resources/screenshots/OpenAPI-Test.png)

### Generating Code from cURL (Smart Paste)

If a `curl` command is detected while pasint into feature files it will be transformed into Karate syntax and pasted into the VSCode Editor.

### Generating Mocks from cURL commands output (Smart Paste)

If a `curl` command... TODO

## Other functionality

### Peek

You can navigate between files, features and scenario @tags using `Control-Click`

You can also navigate to scenarios by @tag in the same or in different feature file (TODO)

## Configuration

### .vscode/launch.json

When you click 'Karate Debug' for the first time if .vscode/launch.js does not exist one will be created for you with this contents. This is a one time step, after this file is created you can start debuging normally.

```json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "karate-ide",
            "name": "Karate IDE (debug)",
            "request": "launch"
        }
    ]
}
```

### Karate classpath

Karate-IDE classpath is the only configuration that won't work out of the box and you will need to make a decision about.

Karate runtime uses java JRE runtime to execute features but because it works with any JRE version (from 1.8 onwards) most probably you already have a compatible java JRE installed.

You still need to provide a way for Karate-IDE to find karate java classes (namely karate.jar)

#### Using karate.jar (Karate fat jar)

The easiest way is to download the latest executable form https://dl.bintray.com/ptrthomas/karate/ and rename it to your project root as `karate.jar`. You don't need to configure anything else but your classpath will be limited to karate.jar.

Alternatively you can configure in setting a different path to karate.jar.

```json
{
    "karateIDE.karateCli.classpath": "<path to your file>/karate.jar"
}
```

#### Using mvn dependency:copy-dependencies

If you are using maven, this is our recommended way to get a full project classpath while debuging with vscode. First you need to run the following command in order to download all project dependencies to `target/dependency`:

```
mvn dependency:copy-dependencies
```

Now you can add this lines to .vscode/settings.json (Replace `;` (for windows) with `:` (for other OS))

```json
{
    "karateIDE.karateCli.classpath": "target/classes;target/test-classes;src/test/resources;src/test/java;target/dependency/*"
}
```

NOTE: remember to re-download dependencies again after mvn clean os any dependency version upgrade.

#### Using mvn dependency:build-classpath

If you are lucky you may be able to configure "karateIDE.karateCli.classpath" with the output from this mvn command

```
mvn dependency:build-classpath
```

### Run/Debug command templates

Karate-IDE uses a template for configuring Run and Debug commands.

Default configuration favors karate.jar cli but you can build any command line you would need for your Operating System, default shell and build system.

Default configured templates works out of the box with PowerShell, bash and zsh so in most cases you shouldn't need to configure these.

```json
{
    "karateIDE.karateCli.runCommandTemplate": "java '-Dkarate.env=${karateEnv}' '-Dvscode.port=${vscodePort}' -cp '${classpath}' com.intuit.karate.Main ${karateOptions} '${feature}'",
    "karateIDE.karateCli.debugCommandTemplate": "java '-Dkarate.env=${karateEnv}' '-Dvscode.port=${vscodePort}' -cp '${classpath}' com.intuit.karate.Main -d"
}
```

There is also `${KarateTestRunner}` template variable if you want to build a

**Enjoy!**
