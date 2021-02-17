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

It uses the DebugAdapter originaly developed by Peter Thomas and Kirk Slota.

https://twitter.com/KarateDSL/status/1167533484560142336
https://github.com/kirksl/karate-runner/

## Explore your APIs

Now you can also explore your API from within VS Code. Karate is (one of) the best API testing automation tools.

With this extension you can leverage your existing scripts to explore your API while you develop your test scripts. No need to maintain a separate collection or switch between different programs.

You can also use this extension to generate reusable tests scripts from OpenAPI and cURL.

### Structured HTTP Log Viewer

Forget about reading response payload from text log files.

### Generating Code from OpenAPI definitions

If you want to quickly test/explore and you have an openapi definition you can generate
You can generate reusable karate scenarios from you openapi definitions, with test data yml files.

### Generating Code from cURL (Smart Paste)

If a `curl` command is detected while pasint into feature files it will be transformed into Karate syntax and pasted into the VSCode Editor.

### Generating Mocks from cURL commands output (Smart Paste)

If a `curl` command... TODO

## Other functionality

### Peek

You can navigate between files, features and scenario @tags using `Control-Click`

## Configuration

### .vscode/launch.json

```
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

### Run/Debug command templates

### Karate classpath

#### Using Karate-fat.jar

#### Using mvn dependency:copy-dependencies

#### Using mvn dependency:build-classpath

**Enjoy!**
