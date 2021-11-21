# Change Log

All notable changes to the "karate-ide" extension will be documented in this file.

# 1.0.x

- [X] Http Logs
  - [X] Click on http logs shows request/response/payloads pretty-printed in Karate OutputChannels
  - [X] Copy as expression
  - [X] Copy as Mock
  - [~] Filter payload using JsonPath: Context Menu + Filtering WebView
- [ ] Status Bar
  - [X] Improve summary
  - [X] Run/Debug buttons for each failed scenario
  - [-] Run/Debug button to replay all and only failed scenarios
    - [-] Not Supported By karate-core yet
- [X] OutputChannel
  - [no] Click-to-open to relative files
  - [X] Colorize output channel
- [X] Karate Process Server for execution startup performance
  - [X] Keep Debug Session open
  - [X] Keep Execution Session open
- [X] Move Run/Debug buttons to editor gutter (Using native vscode Tests API)
  - [X] Play button in gutter
  - [X] Debug button as right click menu
  - [X] Cross icon for failed tests with summary on hover
- [ ] API Mock
  - [ ] Contribute Mocks RuntimeHooks to karate-core
  - [ ] Implement request/response validation with openapi for mocks
  - [ ] Implement 'routable' openapi examples
  - [ ] Generators for openapi examples

# 0.9.x

- [X] SmartPaste
  - [X] "Paste json as new file" on Outline Examples when pasted over a row with filename and insert row
  - [X] "Paste json object as new row" on Outline Examples mapped by column name
  - [X] "Paste json array as new row" on Outline Examples
  - [X] SmartPaste fix and only on karate files
- [x] OpenAPI generator
  - [X] support both __arg and no __arg styles in @operation Scenarios
  - [X] generate Scenario Outlines examples as inline rows of params
  - [x] Refactor Schema validation generated code
    - [X] Make default schema validation part of @validation Scenario
    - [-] Improve/flexibilize "match each" schema definition
    - [-] Allow mix both default and extended/custom schema validations
- [X] VSCodeRuntimeHook.java patches for karate unexpected behavior
  - [x] onScenarioOutline start/stop
  - [x] onFeatureEnd on empty features
- [x] Remove duplicates in classpath autocompletion
- [X] Fix https://github.com/intuit/karate/issues/1499 "support calling other scenarios in the same (implied) feature by tag" in karate-core
- [X] Expose in karate-core "Keep karate debug session open" as Main command line option
- [X] StatusBar
- [X] Dynamic title bar in Executions/Tests View

# 0.8.x

- [X] Execution Process: 
  - [x] Replace Shell/Tasks and use child_process.spawn and OutpuChannel
  - [x] Singleton
  - [x] Progress bar with scenario name (in notification for Run and statusbar for Debug)
  - [x] Cancelable
- [X] Executions Tree
  - [x] Show Output for single Feature/Scenarios
  - [x] Nested Outline Scenarios
  - [x] Failed Scenarios Tooltip
- [X] Focus/Open on Karate Perspective when running
- [ ] Http Logs
  - [ ] Labels / Copy
  - [x] Thread Name
  - [ ] Nested Features
- [X] Debug Port
- [ ] StatusBar
- [ ] Colorize
- [ ] Reusable Debug Session
- [X] Configure classpath command
- [x] SmartPaste fix and only on karate files
# 0.5.0 

- [x] Karate.env switcher
- [x] Focus/Filter features/scenarios and test-data files using glob regexps and karate tags
- [x] EventLogs Server listening from events send by a karate RuntimeHook with karate runtime information that will feed:
- [x] Structured http logs viewer using a tree view (v1)
  - [ ] Click to open request/response payloads in empty json document
  - [ ] Tree view (v2) with scenarios calls hierarchy
  - [ ] Click to open feature line where http calls are made
  - [ ] JsonPath filter command for opened payload json documents
- [x] Executions view:
  - [x] Replay last execution
  - [x] Play single scenario from last execution
  - [x] Click to open scenario from executions tree
- [ ] Explore a way to keep _session variables_ between manual executions (like authentication sessions or response output)
- [x] Karate feature code generation from OpenAPI definition command
- [x] Refactor launch/debug auto-configuration: don't try to guess build system or depend on configured default terminal to work.