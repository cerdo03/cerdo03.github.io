import { lessons, cacheFrames } from './lessons.js';
import { fetchObject, moveMain, safePosition } from './model.js';

const $ = id => document.getElementById(id);
const storage = 'scion-visual-guide-v1';
let saved;
try { saved = JSON.parse(localStorage.getItem(storage)); } catch { /* Storage is optional. */ }
let lessonIndex = safePosition(saved?.lesson, lessons.length);
let step = 0;
let copies = [false, false, true];
let regionalDown = false;
let currentFrames = [];
let scenario = 'cold';
const path = $('path');
path.innerHTML = lessons.map((lesson, i) => `<a href="#${lesson.id}"><span>${String(i + 1).padStart(2, '0')}</span>${lesson.name}</a>`).join('');
$('contents').open = window.matchMedia('(min-width: 641px)').matches;

function renderFrame() {
  const frame = currentFrames[step];
  $('scene-title').textContent = frame.title;
  $('diagram').innerHTML = frame.diagram;
  $('caption').textContent = frame.caption;
  $('frame-count').textContent = `Step ${step + 1} of ${currentFrames.length}`;
  $('back-frame').disabled = step === 0;
  $('next-frame').disabled = step === currentFrames.length - 1;
  $('next-frame').textContent = step === currentFrames.length - 1 ? 'Walkthrough complete' : 'See what happens →';
  const repeat = $('repeat');
  if (repeat) repeat.disabled = step !== currentFrames.length - 1;
}

function setCache(nextScenario, nextCopies, down = false) {
  scenario = nextScenario;
  copies = [...nextCopies];
  regionalDown = down;
  step = 0;
  currentFrames = cacheFrames(copies, regionalDown, fetchObject(copies, regionalDown));
  document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario)));
  renderFrame();
}

function renderExperiment() {
  const host = $('experiment');
  host.innerHTML = '';
  if (lessons[lessonIndex].id === 'cache') {
    host.innerHTML = '<section class="experiment" aria-label="Cache scenarios"><h3>Try a different starting state</h3><p>Each choice restarts the lookup. Step through it above; then repeat to see the effect of warming the caches.</p><div class="choices"><button type="button" data-scenario="cold">Both caches empty</button><button type="button" data-scenario="regional">Regional hit</button><button type="button" data-scenario="local">Local hit</button><button type="button" id="repeat">Repeat request</button></div></section>';
    host.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => {
      const option = button.dataset.scenario;
      setCache(option, option === 'cold' ? [false, false, true] : option === 'regional' ? [false, true, true] : [true, true, true]);
    }));
    $('repeat').addEventListener('click', () => setCache('repeat', fetchObject(copies, regionalDown).after));
    host.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario)));
  }
  if (lessons[lessonIndex].id === 'main') {
    host.innerHTML = '<section class="experiment"><h3>What if writer 2 reaches main first?</h3><p id="race" aria-live="polite">Choose a winner. Both writers still expect main to be A.</p><div class="choices"><button type="button" data-winner="B">Writer 1 first</button><button type="button" data-winner="D">Writer 2 first</button></div></section>';
    host.querySelectorAll('[data-winner]').forEach(button => button.addEventListener('click', () => {
      const winner = button.dataset.winner;
      const first = moveMain('A', 'A', winner);
      const second = moveMain(first.main, 'A', winner === 'B' ? 'D' : 'B');
      $('race').textContent = `First update accepted: main → ${first.main}. Second update rejected: it expected A, but found ${second.main}. Main stays at ${second.main}.`;
      host.querySelectorAll('[data-winner]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    }));
  }
  if (lessons[lessonIndex].id === 'recap') {
    host.innerHTML = '<section class="experiment"><h3>Check your mental model</h3><p>Your node has P5. A test asks for P7. What should happen?</p><div class="choices"><button type="button" data-answer="wrong">Use P5; the path is the same</button><button type="button" data-answer="right">Look for P7 in the next tier</button></div><p id="feedback" role="status">Optional check. You can always revisit any idea.</p></section>';
    host.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
      $('feedback').textContent = button.dataset.answer === 'right' ? 'Exactly. The requested object identity is P7. A cached P5 remains valid for P5, but cannot supply the changed contents of P7.' : 'Same path, different contents. P5 contains fee = 5; this test needs P7, fee = 7. Revisit “Give content an identity” to see why.';
      host.querySelectorAll('[data-answer]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    }));
  }
}

function render(focus = false) {
  const lesson = lessons[lessonIndex];
  step = 0;
  currentFrames = lesson.id === 'cache' ? cacheFrames(copies, regionalDown, fetchObject(copies, regionalDown)) : lesson.frames;
  $('chapter').textContent = `Idea ${String(lessonIndex + 1).padStart(2, '0')} / ${lessons.length} · ${lessonIndex < 2 ? 'The problem' : lessonIndex < 6 ? 'The data' : lessonIndex < 9 ? 'The system' : 'Your mental model'}`;
  $('title').textContent = lesson.title;
  $('intro').textContent = lesson.intro;
  $('takeaway').textContent = lesson.takeaway;
  $('depth-title').textContent = lesson.depthTitle;
  $('depth-body').innerHTML = lesson.depth;
  document.querySelector('.depth').open = false;
  $('source-note').innerHTML = `${lesson.note} <a href="${lesson.url}">Source ↗</a>`;
  $('position').textContent = `${lessonIndex + 1} / ${lessons.length}`;
  path.querySelectorAll('a').forEach((link, i) => i === lessonIndex ? link.setAttribute('aria-current', 'step') : link.removeAttribute('aria-current'));
  $('previous').disabled = lessonIndex === 0;
  $('next').textContent = lessonIndex === lessons.length - 1 ? 'Revisit the beginning ↺' : 'Next idea →';
  document.title = `${lesson.name} — Source control, rethought`;
  renderExperiment();
  renderFrame();
  try { localStorage.setItem(storage, JSON.stringify({ lesson: lessonIndex })); } catch { /* Storage is optional. */ }
  if (focus) {
    if (window.matchMedia('(max-width: 640px)').matches) $('contents').open = false;
    $('lesson').focus({ preventScroll: true });
    $('lesson').scrollIntoView({ block: 'start' });
  }
}

function navigate(index) { window.location.hash = lessons[index].id; }
$('back-frame').addEventListener('click', () => { if (step > 0) { step--; renderFrame(); } });
$('next-frame').addEventListener('click', () => { if (step < currentFrames.length - 1) { step++; renderFrame(); } });
$('previous').addEventListener('click', () => navigate(Math.max(0, lessonIndex - 1)));
$('next').addEventListener('click', () => navigate((lessonIndex + 1) % lessons.length));
window.addEventListener('hashchange', () => {
  const index = lessons.findIndex(lesson => `#${lesson.id}` === location.hash);
  if (index >= 0) { lessonIndex = index; render(true); }
});
const initial = lessons.findIndex(lesson => `#${lesson.id}` === location.hash);
if (initial >= 0) lessonIndex = initial;
render();
