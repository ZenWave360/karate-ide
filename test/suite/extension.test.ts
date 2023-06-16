import * as assert from 'assert';

import * as mocha from 'mocha';


// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as vscode from 'vscode/test-electron';
import * as vscode from '@vscode/test-electron';

// import * as myExtension from '../../extension';
mocha.suite('Extension Test Suite', () => {
	// vscode.window.showInformationMessage('Start all tests.');

	mocha.test('Sample test', () => {
		assert.strictEqual([1, 2, 3].indexOf(5), -1);
		assert.strictEqual([1, 2, 3].indexOf(0), -1);
	});
});