'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isUpdateAllowed, numericVersion } = require('../electron/update-policy');

test('parses release and prefixed versions', () => {
  assert.deepEqual(numericVersion('v12.3.4'), [12, 3, 4]);
  assert.deepEqual(numericVersion('1.2.3-beta.1'), [1, 2, 3]);
  assert.equal(numericVersion('invalid'), null);
});

test('patch policy remains in the current major and minor line', () => {
  assert.equal(isUpdateAllowed('1.2.3', '1.2.4', 'patch'), true);
  assert.equal(isUpdateAllowed('1.2.3', '1.3.0', 'patch'), false);
  assert.equal(isUpdateAllowed('1.2.3', '2.0.0', 'patch'), false);
});

test('minor and major policies allow the requested compatibility range', () => {
  assert.equal(isUpdateAllowed('1.2.3', '1.9.0', 'minor'), true);
  assert.equal(isUpdateAllowed('1.2.3', '2.0.0', 'minor'), false);
  assert.equal(isUpdateAllowed('1.2.3', '2.0.0', 'major'), true);
});

test('never accepts the same, older, or malformed version', () => {
  assert.equal(isUpdateAllowed('1.2.3', '1.2.3', 'major'), false);
  assert.equal(isUpdateAllowed('1.2.3', '1.2.2', 'major'), false);
  assert.equal(isUpdateAllowed('1.2.3', 'next', 'major'), false);
});
