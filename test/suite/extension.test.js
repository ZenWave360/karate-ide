"use strict";
exports.__esModule = true;
var assert = require("assert");
var mocha = require("mocha");
// import * as myExtension from '../../extension';
mocha.suite('Extension Test Suite', function () {
    // vscode.window.showInformationMessage('Start all tests.');
    mocha.test('Sample test', function () {
        assert.strictEqual([1, 2, 3].indexOf(5), -1);
        assert.strictEqual([1, 2, 3].indexOf(0), -1);
    });
});
