import { chooseSide, classifyGesture, createSession, recordFlip } from './coinflip-domain.js';

/** @template {HTMLElement} T @param {string} id @returns {T} */
function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing coinflip element: ${id}`);
  return /** @type {T} */ (node);
}
const coin = /** @type {HTMLButtonElement} */ (element('coin'));
const flip = /** @type {HTMLButtonElement} */ (element('flip-coin'));
const reset = /** @type {HTMLButtonElement} */ (element('reset-coin'));
const body = element('coin-body');
const result = element('coin-result');
const error = element('coin-error');
const history = element('coin-history');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let session = createSession();
let busy = false;
let angle = 0;
/** @type {Animation | null} */
let animation = null;
/** @type {{id: number, start: import('./coinflip-domain.js').Sample, samples: import('./coinflip-domain.js').Sample[]} | null} */
let gesture = null;

function render() {
  element('heads-count').textContent = String(session.heads);
  element('tails-count').textContent = String(session.tails);
  element('total-count').textContent = String(session.total);
  history.replaceChildren(...session.history.map((entry) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.textContent = String(entry.number).padStart(2, '0');
    item.append(number, ` ${entry.side}`);
    return item;
  }));
  history.hidden = session.total === 0;
  element('coin-empty').hidden = session.total !== 0;
  reset.disabled = busy || session.total === 0;
}

/** @param {import('./coinflip-domain.js').Sample[]} [samples] @param {number} [strength] */
async function toss(samples = [], strength = .35) {
  if (busy) return;
  busy = true;
  coin.disabled = flip.disabled = reset.disabled = true;
  error.hidden = true;
  result.textContent = 'Flipping…';
  try {
    const side = await chooseSide({ number: session.total + 1, time: Date.now(), elapsed: performance.now(), samples });
    const target = side === 'Heads' ? 0 : 180;
    const end = 360 * (3 + Math.round(strength * 3)) + target;
    if (!document.hidden) {
      const height = Math.min(85, coin.offsetWidth * .35) * (.55 + strength * .45);
      animation = body.animate(reducedMotion.matches ? [
        { opacity: .4 }, { opacity: 1 }
      ] : [
        { transform: `translateY(0) rotateX(${angle}deg)` },
        { transform: `translateY(-${height}px) rotateX(${end * .48}deg) rotateZ(-8deg)`, offset: .42 },
        { transform: `translateY(0) rotateX(${end}deg)`, offset: .92 },
        { transform: `translateY(0) rotateX(${end}deg)` }
      ], { duration: reducedMotion.matches ? 140 : 900 + 700 * strength, easing: 'cubic-bezier(.2,.6,.35,1)' });
      // Cancellation and backgrounding settle the already chosen result exactly once.
      await animation.finished.catch(() => {});
    }
    angle = target;
    body.style.transform = `rotateX(${angle}deg)`;
    session = recordFlip(session, side);
    result.textContent = side;
    coin.setAttribute('aria-label', `${side}. Flip a euro coin`);
  } catch (cause) {
    result.textContent = 'Could not flip';
    error.textContent = cause instanceof Error ? cause.message : 'Unable to generate a secure result. Please try again.';
    error.hidden = false;
  } finally {
    animation = null;
    busy = false;
    coin.disabled = flip.disabled = false;
    render();
  }
}

/** @param {PointerEvent} event */
function sample(event) {
  return { x: event.clientX, y: event.clientY, t: event.timeStamp, pressure: event.pressure };
}
coin.addEventListener('pointerdown', (event) => {
  if (busy || gesture || !event.isPrimary || event.button !== 0) return;
  const start = sample(event);
  gesture = { id: event.pointerId, start, samples: [start] };
  coin.setPointerCapture(event.pointerId);
});
coin.addEventListener('pointermove', (event) => {
  if (!gesture || event.pointerId !== gesture.id) return;
  gesture.samples.push(sample(event));
  if (gesture.samples.length > 63) gesture.samples.splice(1, 1);
});
coin.addEventListener('pointerup', (event) => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const current = gesture;
  gesture = null;
  const end = sample(event);
  const action = classifyGesture(current.start, end);
  if (coin.hasPointerCapture(event.pointerId)) coin.releasePointerCapture(event.pointerId);
  if (action.kind !== 'none') void toss([...current.samples, end], action.strength);
});
coin.addEventListener('pointercancel', () => { gesture = null; });
coin.addEventListener('lostpointercapture', () => { gesture = null; });
// Pointer activation is handled on release; detail=0 covers keyboard and assistive activation.
coin.addEventListener('click', (event) => { if (event.detail === 0) void toss(); });
flip.addEventListener('click', () => { void toss(); });
reset.addEventListener('click', () => {
  if (busy) return;
  session = createSession();
  angle = 0;
  body.style.transform = '';
  result.textContent = 'Your call, chance.';
  coin.setAttribute('aria-label', 'Flip a euro coin');
  error.hidden = true;
  render();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { gesture = null; animation?.finish(); }
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) animation?.finish(); });
coin.disabled = flip.disabled = false;
render();
