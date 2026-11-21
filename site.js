const labs = {
  dash: {
    name: 'Dash Lab', kicker: 'MOVEMENT / 01', label: '01 / PATH TRACE', title: 'Example dash path',
    description: 'Pick a move, draw over its example, and replay your path.', control: 'Position',
    format: value => `${Math.round(value)}%`,
  },
  timing: {
    name: 'Timing Lab', kicker: 'TIMING / 02', label: '02 / TIMING TRACE', title: 'Two example timing pulses',
    description: 'Scrub a sample timeline to see where two timing pulses overlap.', control: 'Sample time',
    path: 'M40 182H135C162 182 181 70 218 70S259 182 301 182H520',
    reference: 'M40 182H200C227 182 246 70 283 70S324 182 366 182H520',
    format: value => `${Math.round(value * 6)} ms`,
  },
  sync: {
    name: 'Animation Sync', kicker: 'ANIMATION / 03', label: '03 / FRAME COMPARISON', title: 'Two example animation tracks',
    description: 'Compare the active track with its reference at the same frame.', control: 'Sample frame',
    path: 'M40 179C91 179 108 63 177 63S241 164 301 164S365 53 424 53S481 120 520 120',
    reference: 'M40 156C95 156 124 106 185 106S246 182 304 182S377 82 441 82S478 142 520 142',
    format: value => `${Math.round(value * .6)} / 60`,
  },
};

const patterns = {
  twisted: 'M40 180C143 193 183 166 206 112S307 34 348 74S367 180 433 177S499 129 520 88',
  lethal: 'M40 183C141 214 163 115 251 86S424 112 520 46',
};

const get = id => document.getElementById(id);
const tabs = [...document.querySelectorAll('[data-tab]')];
const pill = document.querySelector('.tab-pill');
const panel = get('lab-panel');
const scrub = get('scrub');
const track = get('track');
const trace = get('trace');
const reference = get('reference');
const head = get('playhead');
const cursor = get('cursor');
const wake = get('trace-wake');
const arrival = get('trace-arrival');
const plot = get('plot');
const drawCursor = get('draw-cursor');
const drawButton = get('draw-path');
const patternButtons = [...document.querySelectorAll('[data-pattern]')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let current = 'dash';
let pattern = 'twisted';
const drawings = {};
let drawing = false;
let pointer = null;
let points = [];
let point = { x: 40, y: 182 };
const maxPoints = 512;
let total = 0;
let replayFrame = 0;
let arrivalAnimation;
let swap;

function paint(value) {
  const progress = Math.max(0, Math.min(1, value / 100));
  let distance = total * progress;
  // A movement path uses distance. Timelines use the horizontal time axis instead.
  if (current !== 'dash') {
    const x = 40 + 480 * progress;
    let lo = 0, hi = total;
    for (let index = 0; index < 14; index++) {
      const mid = (lo + hi) / 2;
      if (track.getPointAtLength(mid).x < x) lo = mid;
      else hi = mid;
    }
    distance = (lo + hi) / 2;
  }
  const { x, y } = track.getPointAtLength(distance);
  head.setAttribute('cx', x);
  head.setAttribute('cy', y);
  cursor.setAttribute('x1', x);
  cursor.setAttribute('x2', x);
  trace.style.strokeDashoffset = 1 - (total ? distance / total : 0);
  scrub.parentElement.style.setProperty('--progress', `${progress * 100}%`);
  const text = labs[current].format(value);
  get('scrub-output').value = text;
  scrub.setAttribute('aria-valuetext', text);
}

function positionPill() {
  const button = tabs.find(tab => tab.dataset.tab === current);
  pill.style.width = `${button.offsetWidth}px`;
  pill.style.transform = `translateX(${button.offsetLeft}px)`;
}

function setPath(path, position) {
  track.setAttribute('d', path);
  trace.setAttribute('d', path);
  wake.setAttribute('d', path);
  total = track.getTotalLength();
  scrub.value = position;
  paint(position);
}

function stopReplay() {
  cancelAnimationFrame(replayFrame);
  arrivalAnimation?.cancel();
  wake.setAttribute('opacity', '0');
}

function setDrawing(on) {
  drawing = on;
  plot.classList.toggle('drawing', on);
  plot.setAttribute('role', on ? 'group' : 'img');
  if (on) {
    plot.tabIndex = 0;
    plot.setAttribute('aria-describedby', 'draw-help');
  } else {
    plot.removeAttribute('tabindex');
    plot.removeAttribute('aria-describedby');
  }
  drawButton.setAttribute('aria-pressed', String(on));
  drawButton.textContent = on ? 'Finish drawing' : 'Draw path';
  drawCursor.toggleAttribute('hidden', !on);
  scrub.disabled = on;
  get('replay').disabled = on;
}

function showPattern(position = 42) {
  for (const button of patternButtons) button.setAttribute('aria-pressed', String(button.dataset.pattern === pattern));
  const name = pattern === 'twisted' ? 'Instant Twisted' : 'Instant Lethal';
  get('plot-title').textContent = `${name} path`;
  get('sample-label').textContent = `01 / ${name.toUpperCase()}`;
  get('plot-status').textContent = drawings[pattern] ? 'CUSTOM PATH' : 'EXAMPLE PATH';
  setPath(drawings[pattern] ?? patterns[pattern], position);
}

function cancelDrawing() {
  if (pointer !== null && plot.hasPointerCapture(pointer)) plot.releasePointerCapture(pointer);
  pointer = null;
  points = [];
  setDrawing(false);
}

function finishDrawing() {
  const custom = points.length > 1;
  if (custom) drawings[pattern] = track.getAttribute('d');
  cancelDrawing();
  showPattern(custom ? 100 : 42);
  get('draw-status').textContent = custom ? 'Custom path ready to replay.' : 'No new path drawn.';
  drawButton.focus({ preventScroll: true });
}

function moveDrawingCursor(next) {
  point = { x: Math.max(10, Math.min(550, Math.round(next.x))), y: Math.max(10, Math.min(230, Math.round(next.y))) };
  drawCursor.setAttribute('cx', point.x);
  drawCursor.setAttribute('cy', point.y);
}

function addPoint(next) {
  if (points.length >= maxPoints) return;
  moveDrawingCursor(next);
  const last = points.at(-1);
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < 3) return;
  points.push(point);
  setPath(points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' '), 100);
}

function pointerPoint(event) {
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(plot.getScreenCTM().inverse());
}

drawButton.addEventListener('click', () => {
  if (drawing) return finishDrawing();
  stopReplay();
  points = [];
  moveDrawingCursor({ x: 40, y: 182 });
  setDrawing(true);
  get('plot-status').textContent = 'DRAW MODE';
  plot.focus({ preventScroll: true });
});

plot.addEventListener('pointerdown', event => {
  if (!drawing || pointer !== null || event.button !== 0) return;
  event.preventDefault();
  pointer = event.pointerId;
  plot.setPointerCapture(pointer);
  points = [];
  addPoint(pointerPoint(event));
});
plot.addEventListener('pointermove', event => {
  if (pointer === event.pointerId) addPoint(pointerPoint(event));
});
plot.addEventListener('pointerup', event => {
  if (pointer !== event.pointerId) return;
  addPoint(pointerPoint(event));
  if (points.length > 1) finishDrawing();
  else pointer = null;
});
for (const event of ['pointercancel', 'lostpointercapture']) plot.addEventListener(event, ({ pointerId }) => {
  if (pointer !== pointerId) return;
  pointer = null;
  points = [];
  showPattern();
  get('plot-status').textContent = 'DRAW MODE';
});
plot.addEventListener('keydown', event => {
  if (!drawing) return;
  if (event.key === 'Escape') {
    cancelDrawing();
    showPattern();
    drawButton.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    addPoint(point);
    return;
  }
  const offsets = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  moveDrawingCursor({ x: point.x + offset[0], y: point.y + offset[1] });
});
for (const button of patternButtons) button.addEventListener('click', () => {
  stopReplay();
  cancelDrawing();
  pattern = button.dataset.pattern;
  showPattern();
});
get('reset-path').addEventListener('click', () => {
  stopReplay();
  cancelDrawing();
  delete drawings[pattern];
  showPattern();
  get('draw-status').textContent = 'Example path restored.';
});

function select(name, animate = true) {
  if (!Object.hasOwn(labs, name)) return;
  const changed = current !== name;
  stopReplay();
  cancelDrawing();
  current = name;
  const lab = labs[name];
  for (const tab of tabs) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
    if (selected) panel.setAttribute('aria-labelledby', tab.id);
  }
  positionPill();
  for (const [id, text] of Object.entries({
    'sample-label': lab.label, 'plot-title': lab.title, 'lab-kicker': lab.kicker,
    'lab-title': lab.name, 'lab-description': lab.description, 'scrub-label': lab.control,
  })) get(id).textContent = text;
  get('dash-options').hidden = name !== 'dash';
  get('plot-guide').textContent = name === 'dash' ? 'DRAW · SCRUB · REPLAY' : 'START';
  get('plot-end').textContent = name === 'dash' ? 'PATH EDITOR' : 'END';
  get('replay-label').textContent = name === 'dash' ? 'Replay path' : 'Replay sample';
  reference.setAttribute('d', lab.reference ?? '');
  if (name === 'dash') showPattern();
  else {
    get('plot-status').textContent = 'SAMPLE DATA';
    setPath(lab.path, 42);
  }
  swap?.cancel();
  if (animate && changed && !motion.matches) {
    swap = panel.animate([{ opacity: .55, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 360, easing: 'cubic-bezier(.23,1,.32,1)' });
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => select(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    const next = direction ? (index + direction + tabs.length) % tabs.length :
      event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next === -1) return;
    event.preventDefault();
    select(tabs[next].dataset.tab);
    tabs[next].focus();
  });
}

document.querySelectorAll('[data-open]').forEach(link => link.addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  select(link.dataset.open);
}));

scrub.addEventListener('input', () => {
  stopReplay();
  paint(Number(scrub.value));
});

get('replay').addEventListener('click', () => {
  stopReplay();
  if (motion.matches) {
    scrub.value = 100;
    paint(100);
    return;
  }
  const start = performance.now();
  const isDash = current === 'dash';
  const duration = isDash ? 1480 : 1220;
  scrub.value = 0;
  paint(0);
  function frame(now) {
    const time = Math.min(1, Math.max(0, (now - start) / duration));
    const eased = isDash ? time * time * (3 - 2 * time) : time;
    const value = 100 * eased;
    scrub.value = Math.round(value);
    paint(value);
    if (isDash) {
      const tail = Math.min(.12, eased);
      wake.setAttribute('stroke-dasharray', `${tail} 1`);
      wake.setAttribute('stroke-dashoffset', String(tail - eased));
      wake.setAttribute('opacity', String(.27 * Math.sin(Math.PI * time)));
    }
    if (time < 1) replayFrame = requestAnimationFrame(frame);
    else if (isDash) {
      wake.setAttribute('opacity', '0');
      arrival.setAttribute('cx', head.getAttribute('cx'));
      arrival.setAttribute('cy', head.getAttribute('cy'));
      arrivalAnimation = arrival.animate([
        { r: '7px', opacity: .85 }, { r: '25px', opacity: 0 },
      ], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }
  replayFrame = requestAnimationFrame(frame);
});

motion.addEventListener('change', () => {
  stopReplay();
  swap?.cancel();
  paint(Number(scrub.value));
});

select('dash', false);
pill.parentElement.classList.add('enhanced');
new ResizeObserver(positionPill).observe(pill.parentElement);
document.fonts.ready.then(positionPill);

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      if (!motion.matches && !target.contains(document.activeElement)) {
        const layers = target.matches('.lab-index') ? [...target.children] : [target];
        layers.forEach((layer, index) => layer.animate([
          { opacity: .1, translate: '0 24px' }, { opacity: 1, translate: '0 0' },
        ], { duration: 610, delay: index * 72, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)' }));
      }
      reveal.unobserve(target);
    }
  }, { threshold: .08 });
  document.querySelectorAll('[data-reveal]').forEach(element => reveal.observe(element));
}
