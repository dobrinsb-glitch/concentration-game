import { createDeck, formatSeconds, remainingSeconds } from './model.mjs';

export function mountBoard({
  asset,
  createElement,
  createHotspot,
  gameSeconds,
  onHome,
  onRestart,
  onResult,
  position,
  random = Math.random,
  stage
}) {
  let active = true;
  let delay;
  let locked = false;
  let matched = 0;
  let picked = [];
  const deadline = Date.now() + gameSeconds * 1000;

  createHotspot('Home', 10, 4, 140, 134, onHome);
  const refresh = createHotspot('Restart game', 930, 15, 130, 110, onRestart);
  refresh.style.background = `url(${asset('refresh.png')}) center/contain no-repeat`;
  const timer = createElement('div', stage, 'timer');

  function finish(won) {
    if (!active) return;
    onResult(won);
  }

  function updateTimer() {
    const seconds = remainingSeconds(deadline);
    timer.textContent = formatSeconds(seconds);
    if (!seconds) finish(false);
  }

  updateTimer();
  const tick = setInterval(updateTimer, 100);
  const { faces, backs } = createDeck(random);

  faces.forEach((faceId, index) => {
    const button = createElement('button', stage, 'tile');
    position(
      button,
      [128, 345, 562, 778][index % 4],
      [288, 585, 882, 1179, 1476][Math.floor(index / 4)],
      174,
      260
    );
    button.ariaLabel = `Tile ${index + 1}`;
    const flip = createElement('span', button);
    createElement('img', flip).src = asset(`back${backs[index]}.jpg`);
    createElement('img', flip, 'face').src = asset(`face${faceId}.jpg`);
    button.addEventListener('click', () => {
      if (Date.now() >= deadline) return finish(false);
      if (locked || button.disabled) return;
      button.disabled = true;
      button.classList.add('turned');
      picked.push({ button, faceId });
      if (picked.length < 2) return;
      if (picked[0].faceId === faceId) {
        picked = [];
        matched += 1;
        if (matched === faces.length / 2) finish(true);
      } else {
        locked = true;
        delay = setTimeout(() => {
          picked.forEach(({ button: pickedButton }) => {
            pickedButton.disabled = false;
            pickedButton.classList.remove('turned');
          });
          picked = [];
          locked = false;
        }, 900);
      }
    });
  });

  return () => {
    active = false;
    clearInterval(tick);
    clearTimeout(delay);
  };
}
