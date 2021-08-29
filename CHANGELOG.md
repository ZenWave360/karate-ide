# Change Log

All notable changes to the "karate-ide" extension will be documented in this file.

# 0.8.0

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
- [ ] SmartPaste fix and only on karate files
# 0.5.0 

- [x] Karate.env switcher
- [x] Focus/Filter features/scenarios and test-data files using glob regexps and karate tags
- [x] EventLogs Server listening from events send by a karate RuntimeHook with karate runtime information that will feed:
- [x] Structured http logs viewer using a tree view (v1)
  - [ ] Click to open request/response payloads in empty json document
  - [ ] Tree view (v2) with scenarios calls hierarchy
  - [ ] Click to open feature line where http calls are made
  - [ ] JsonPath filter command for opened payload json documents
- [x] Excutions view:
  - [x] Replay last execution
  - [x] Play single scenario from last execution
  - [x] Click to open scenario from executions tree
- [ ] Explore a way to keep _session variables_ between manual executions (like authentication sessions or response output)
- [x] Karate feature code generation from OpenAPI definition command
- [x] Refactor launch/debug auto-configuration: don't try to guess build system or depend on configured default terminal to work.