# Change Log

All notable changes to the "karate-ide" extension will be documented in this file.

# 1.5.0
- [x] Adds DapServer to vscode.jar to bring back `debug`support
- [x] Compilation against karate-core 1.5.0


# 1.4.1
- [x] Fixes support for openapi property type "number" when generating validation schemas.

# 1.4.0
- [x] Upgrades API-Mock to karate.jar 1.4.1
- [x] Validates compatibility with karate.jar 1.4.1

# 1.3.6
- [x] Adds min,max & pattern validation based on open API schema
- [x] Fix for "Validation Schemas" generated from OpenAPI supporting "required fields" #30

# 1.3.5
- [x] Fixes "Validation Schemas" generated from OpenAPI supporting "required fields" #30

# 1.3.4
- [x] Upgrade to zenwave-apimock 0.1.4
- [x] Remove old "Configure classpath" entries
- [x] Validate compatibility with karate.jar 1.4.0

# 1.3.3
- [x] Clear HttpLogs view on each new request

# 1.3.2
- [x] Fallback "activationEvents" to "*"

## 1.3.1

- [x] Compatibility with karate 1.3.0
- [x] Upgrade to ApiMock 0.1.2 for karate 1.3.0 compatibility

## 1.2.2

-   [x] fixes reloading karate test files after adding features
-   [ ] openapi generator: use @ shortcut to call scenario in same feature
-   [x] fixes calculate rootFolder when no marker file is found

## 1.2.1

-   [x] Updates ZenWave APIMock for Karate 1.2.1

## 1.2.0

-   [x] Adds Karate 1.2.0 option to `KarateIDE: Configure Classpath`
-   [x] Adds "Generating KarateDSL tests from OpenAPI definition" video to README.md

## 1.1.2

-   [x] Add support for multi-root workspace

## 1.1.1

-   [x] Renamed to ZenWave KarateIDE
-   [x] Adds "High Fidelity Stateful Mocks (Consumer Contracts) with OpenAPI and KarateDSL" link to readme.
-   [x] Upgrades [ZenWave ApiMock](https://github.com/ZenWave360/apimock) to version 0.0.6

## 1.1.0

-   [x] Upgrades [ZenWave ApiMock](https://github.com/ZenWave360/apimock) to version 0.0.5
-   [x] Adds configuration to override apimock.jar location
-   [x] On config change `Kill Karate Process`
-   [x] Network Logs: adds section in tree for query params
-   [x] Network Logs: improves labels and tooltips
-   [x] Fix target classpath folder for karate-auth.js
-   [x] Autogenerate matchResponse = "true" by default only for 2xx status codes
-   [x] Calculate classpath root when generating "Business Flow Tests"
-   [x] Narrow down "activationEvents"
-   [x] Upgrade generated karate-project templates
-   [x] Show `cwd` on Execution logs and keep it when switching log views
-   [ ] On delete .feature files remove them from Tests Explorer

## 1.0.4

-   [x] Adds `KarateIDE: Generate Karate Project` command.
-   [x] Adds SmartPaste to editor/context
-   [x] Use 'openapi-sampler' for generating example payloads
-   [x] Improves how text responses are shown in Karate Output Channel
-   [x] Document `Kill Karate Process` and classpath cache

## 1.0.3

-   [x] Fixes vscode RuntimeHook for Java 17
-   [x] Removes `karateIDE.tests.watchForFeatures` to disable watching for workspace changes

## 1.0.2

-   improves Karate classpath configuration error messages
-   Adds LinkedIn white paper to README.md

## 1.0.1

-   [x] Updates README.md with new screenshots and descriptions
-   [x] Adds `karateIDE.tests.watchForFeatures` to disable watching for workspace changes and circunvent vscode `rg` process eating up all CPU in some cases.
-   [x] Fixes ApiMock to stop sending responses as pretty printed JSON

## 1.0.0

-   [x] Http Logs
    -   [x] Click on http logs shows request/response/payloads pretty-printed in Karate OutputChannels
    -   [x] Copy as expression
    -   [x] Copy as Mock
    -   [~] Filter payload using JsonPath: Context Menu + Filtering WebView
-   [x] Status Bar
    -   [x] Real time test execution status
    -   [x] Click to relaunch last run/debug
-   [x] OutputChannel
    -   [no] Click-to-open to relative files
    -   [x] Colorize output channel
-   [x] Karate Process Server for execution startup performance
    -   [x] Keep Debug Session open
    -   [x] Keep Execution Session open
-   [x] Move Run/Debug buttons to editor gutter (Using native vscode Tests API)
    -   [x] Play button in gutter
    -   [x] Debug button as right click menu
    -   [x] Cross icon for failed tests with summary on hover
-   [ ] API Mock
    -   [x] APIMock library for reusing openapi schemas and examples in Karate Mocks
    -   [x] UI Mock Runner with apimock/openapi support
    -   [ ] Contribute Mocks RuntimeHooks to karate-core
    -   [x] Implement request/response validation with openapi for mocks
    -   [x] Implement 'routable' openapi examples
    -   [x] Generators for openapi examples
-   [ ] OpenAPI generators
    -   [x] Business flow test generator
    -   [x] Stateful mock generator
    -   [x] Test for mock validation (simple)
-   [ ] Linkedin article: "from zero to contract testing for rest apis"

## 0.9.x

-   [x] SmartPaste
    -   [x] "Paste json as new file" on Outline Examples when pasted over a row with filename and insert row
    -   [x] "Paste json object as new row" on Outline Examples mapped by column name
    -   [x] "Paste json array as new row" on Outline Examples
    -   [x] SmartPaste fix and only on karate files
-   [x] OpenAPI generator
    -   [x] support both **arg and no **arg styles in @operation Scenarios
    -   [x] generate Scenario Outlines examples as inline rows of params
    -   [x] Refactor Schema validation generated code
        -   [x] Make default schema validation part of @validation Scenario
        -   [-] Improve/flexibilize "match each" schema definition
        -   [-] Allow mix both default and extended/custom schema validations
-   [x] VSCodeRuntimeHook.java patches for karate unexpected behavior
    -   [x] onScenarioOutline start/stop
    -   [x] onFeatureEnd on empty features
-   [x] Remove duplicates in classpath autocompletion
-   [x] Fix https://github.com/intuit/karate/issues/1499 "support calling other scenarios in the same (implied) feature by tag" in karate-core
-   [x] Expose in karate-core "Keep karate debug session open" as Main command line option
-   [x] StatusBar
-   [x] Dynamic title bar in Executions/Tests View

## 0.8.x

-   [x] Execution Process:
    -   [x] Replace Shell/Tasks and use child_process.spawn and OutpuChannel
    -   [x] Singleton
    -   [x] Progress bar with scenario name (in notification for Run and statusbar for Debug)
    -   [x] Cancelable
-   [x] Executions Tree
    -   [x] Show Output for single Feature/Scenarios
    -   [x] Nested Outline Scenarios
    -   [x] Failed Scenarios Tooltip
-   [x] Focus/Open on Karate Perspective when running
-   [ ] Http Logs
    -   [ ] Labels / Copy
    -   [x] Thread Name
    -   [ ] Nested Features
-   [x] Debug Port
-   [ ] StatusBar
-   [ ] Colorize
-   [ ] Reusable Debug Session
-   [x] Configure classpath command
-   [x] SmartPaste fix and only on karate files

## 0.5.0

-   [x] Karate.env switcher
-   [x] Focus/Filter features/scenarios and test-data files using glob regexps and karate tags
-   [x] EventLogs Server listening from events send by a karate RuntimeHook with karate runtime information that will feed:
-   [x] Structured http logs viewer using a tree view (v1)
    -   [ ] Click to open request/response payloads in empty json document
    -   [ ] Tree view (v2) with scenarios calls hierarchy
    -   [ ] Click to open feature line where http calls are made
    -   [ ] JsonPath filter command for opened payload json documents
-   [x] Executions view:
    -   [x] Replay last execution
    -   [x] Play single scenario from last execution
    -   [x] Click to open scenario from executions tree
-   [ ] Explore a way to keep _session variables_ between manual executions (like authentication sessions or response output)
-   [x] Karate feature code generation from OpenAPI definition command
-   [x] Refactor launch/debug auto-configuration: don't try to guess build system or depend on configured default terminal to work.
