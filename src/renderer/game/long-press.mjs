export const SETTINGS_HOLD_MS = 10_000;

export function bindLongPress(
  button,
  action,
  {
    durationMs = SETTINGS_HOLD_MS,
    clearTimer = clearTimeout,
    setTimer = setTimeout
  } = {}
) {
  let timer;

  function cancel() {
    if (timer === undefined) return;
    clearTimer(timer);
    timer = undefined;
  }

  function start() {
    if (timer !== undefined) return;
    timer = setTimer(() => {
      timer = undefined;
      action();
    }, durationMs);
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    start();
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    start();
  }

  function onKeyUp(event) {
    if (event.key === 'Enter' || event.key === ' ') cancel();
  }

  function preventDefault(event) {
    event.preventDefault();
  }

  const listeners = [
    ['pointerdown', onPointerDown],
    ['pointerup', cancel],
    ['pointercancel', cancel],
    ['lostpointercapture', cancel],
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['blur', cancel],
    ['click', preventDefault],
    ['contextmenu', preventDefault]
  ];

  listeners.forEach(([type, listener]) => button.addEventListener(type, listener));

  return () => {
    cancel();
    listeners.forEach(([type, listener]) => button.removeEventListener(type, listener));
  };
}
