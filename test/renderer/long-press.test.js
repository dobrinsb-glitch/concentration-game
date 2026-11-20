'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const longPress = import('../../src/renderer/game/long-press.mjs');

function fakeButton() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, values = {}) {
      const event = { preventDefault() {}, ...values };
      listeners.get(type)?.(event);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    setPointerCapture() {}
  };
}

function fakeTimers() {
  let callback;
  let delay;
  let cleared = false;
  return {
    clearTimer() {
      cleared = true;
      callback = undefined;
    },
    fire() {
      callback?.();
    },
    get cleared() {
      return cleared;
    },
    get delay() {
      return delay;
    },
    setTimer(nextCallback, nextDelay) {
      callback = nextCallback;
      delay = nextDelay;
      return 1;
    }
  };
}

test('settings action is scheduled only after a 10-second hold', async () => {
  const { bindLongPress, SETTINGS_HOLD_MS } = await longPress;
  const button = fakeButton();
  const timers = fakeTimers();
  let opened = 0;

  bindLongPress(button, () => opened += 1, timers);
  button.dispatch('pointerdown', { button: 0, pointerId: 1 });

  assert.equal(timers.delay, SETTINGS_HOLD_MS);
  assert.equal(opened, 0);
  timers.fire();
  assert.equal(opened, 1);
});

test('releasing or cancelling the hold prevents settings from opening', async () => {
  const { bindLongPress } = await longPress;

  for (const endEvent of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
    const button = fakeButton();
    const timers = fakeTimers();
    let opened = false;
    bindLongPress(button, () => opened = true, timers);
    button.dispatch('pointerdown', { button: 0, pointerId: 1 });
    button.dispatch(endEvent);
    timers.fire();
    assert.equal(opened, false, endEvent);
    assert.equal(timers.cleared, true, endEvent);
  }
});

test('ordinary clicks and right clicks do not open settings', async () => {
  const { bindLongPress } = await longPress;
  const button = fakeButton();
  const timers = fakeTimers();
  let opened = false;

  bindLongPress(button, () => opened = true, timers);
  button.dispatch('click');
  button.dispatch('pointerdown', { button: 2, pointerId: 1 });
  timers.fire();

  assert.equal(opened, false);
  assert.equal(timers.delay, undefined);
});
