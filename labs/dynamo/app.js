import { contentURL } from './content-url.js?v=dynamo20261023-final';
import { lessons } from './lessons.js?v=dynamo20261023-final';
import { evolutionLab } from './evolution-lab.js?v=dynamo20261023-final';
import { operationsLab } from './operations-lab.js?v=dynamo20261023-final';
import { controlPlane } from './control-plane.js?v=dynamo20261023-final';
import { annotateSymbols, glossary } from './symbols.js?v=dynamo20261023-final';
import { requestLab } from './request-lab.js?v=dynamo20261023-final';
import { experiment } from './experiments.js?v=dynamo20261023-final';
import { capstone } from './capstone.js?v=dynamo20261023-final';
import { laboratory } from './laboratories.js?v=dynamo20261023-final';
import { compareClocks } from './model.js?v=dynamo20261023-final';

const versions = [
  { id: 'D1', clock: { Sx: 1 }, parent: 'new object', text: 'First write via Sx: cart contains book.' },
  { id: 'D2', clock: { Sx: 2 }, parent: 'D1', text: 'Update via Sx includes D1. D2 supersedes D1.' },
  { id: 'D3', clock: { Sx: 2, Sy: 1 }, parent: 'D2', text: 'Client updates D2 via Sy, adding pen.' },
  { id: 'D4', clock: { Sx: 2, Sz: 1 }, parent: 'D2', text: 'Another client updates D2 via Sz, removing book. It has not seen D3.' },
  { id: 'D5', clock: { Sx: 3, Sy: 1, Sz: 1 }, parent: 'D3 + D4', text: 'Client reads both siblings, reconciles contents, then writes via Sx with joined context. Union would resurrect book.' }
];
let step = 0;
const element = id => document.getElementById(id);
const clockLab = element('clock-lab');
const format = clock => JSON.stringify(clock);
function compare() {
  const left = versions[Number(element('left').value)];
  const right = versions[Number(element('right').value)];
  element('comparison').textContent = `${left.id} compared with ${right.id}: ${compareClocks(left.clock, right.clock)}. Compare all components, not arrival time.`;
  element('components').replaceChildren();
  for (const node of ['Sx', 'Sy', 'Sz']) {
    const row = document.createElement('tr');
    for (const value of [node, left.clock[node] ?? 0, right.clock[node] ?? 0]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    element('components').append(row);
  }
}
function render() {
  const known = versions.slice(0, step + 1);
  drawGraph(known);
  element('event').textContent = `Event ${step + 1} of 5. ${versions[step].text}`;
  element('history').replaceChildren();
  for (const version of known) {
    const row = document.createElement('li');
    row.textContent = `${version.parent} → ${version.id} · ${format(version.clock)} · ${version.text}`;
    element('history').append(row);
  }
  for (const id of ['left', 'right']) {
    const select = element(id);
    select.replaceChildren();
    known.forEach((version, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = version.id;
      select.append(option);
    });
  }
  element('left').value = Math.max(0, step - 1);
  element('right').value = step;
  element('previous').disabled = step === 0;
  element('next').disabled = step === 4;
  compare();
}
element('previous').addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
element('next').addEventListener('click', () => { step = Math.min(4, step + 1); render(); });
element('reset').addEventListener('click', () => { step = 0; render(); });
for (const id of ['left', 'right']) element(id).addEventListener('change', compare);
render();

const deepReading = await fetch(contentURL('./deep-reading.json',import.meta.url)).then(response => response.json());
const paperReference = await fetch(contentURL('./paper-reference.json',import.meta.url)).then(response => response.json());
const { sloppyPartition } = await import('./events.js?v=dynamo20261023-final');
const navigation = element('lessons-nav');
let lessonIndex = 0;
let sourceURL;
function showLesson(index) {
  lessonIndex = index;
  try { localStorage.setItem('dynamo-last-lesson', String(index)); } catch { /* Reading works without storage. */ }
  clockLab.hidden = index !== 4;
  const lesson = lessons[index];
  const article = element('lesson');
  article.replaceChildren();
  const title = document.createElement('h1');
  title.textContent = `${index + 1}. ${lesson.title}`;
  const source = document.createElement('p');
  source.textContent = `Paper reference · ${lesson.source}`;
  article.append(title, source);
  if (sourceURL) {
    const link = document.createElement('a');
    link.href = `${sourceURL}#page=${[1,5,5,7,6,8,8,8,9,9,10,4][index]}`;
    link.target = '_blank';link.rel = 'noreferrer';link.textContent = 'Open this section in your selected paper';article.append(link);
  }
  const readingParagraphs = [];
  for (const text of lesson.paragraphs) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    readingParagraphs.push(paragraph);
    article.append(paragraph);
  }
  const demonstrations = document.createElement('div');
  article.insertBefore(demonstrations, readingParagraphs[index === 0 ? 3 : 2] || null);
  if (lesson.experiment === 'write') demonstrations.append(requestLab());
  if (lesson.experiment === 'sloppy') {
    const state = sloppyPartition();
    const paragraph = document.createElement('p');
    paragraph.textContent = `Worked reconstruction: write replies ${state.writeSet.join(', ')}; read replies ${state.readSet.join(', ')}. Actual overlap: ${state.intersection.length} hosts. Both thresholds are two; they refer to different participant sets.`;
    article.append(paragraph);
  }
  const depth = deepReading.lessons[index];
  const definitions = document.createElement('dl');
  for (const item of depth.definitions) {
    const term = document.createElement('dt');term.textContent = item.term;
    const meaning = document.createElement('dd');meaning.textContent = item.meaning;
    definitions.append(term,meaning);
  }
  article.insertBefore(definitions, readingParagraphs[1] || null);
  if (index === 4) demonstrations.append(clockLab);
  if (index === 11) demonstrations.append(capstone());
  if (index === 9) demonstrations.append(operationsLab());
  if (index === 8) demonstrations.append(evolutionLab());
  const extra = experiment(index);
  if (extra) demonstrations.append(extra);
  const plane = controlPlane(index);
  if (plane) demonstrations.append(plane);
  const lab = laboratory(index);
  if (lab) demonstrations.append(lab);
  for (const section of depth.sections) {
    const heading = document.createElement('h2');heading.textContent = section.title;
    const attribution = document.createElement('p');attribution.textContent = `${section.kind} · ${depth.source}`;
    article.append(heading,attribution);
    for (const text of section.paragraphs) { const p = document.createElement('p');p.textContent = text;article.append(p); }
  }
  const check = document.createElement('details');
  const prompt = document.createElement('summary');prompt.textContent = `Optional explanation check: ${depth.teachback.prompt}`;
  const answer = document.createElement('p');answer.textContent = depth.teachback.answer;
  check.append(prompt,answer);article.append(check);
  if (index === 10) {
    const heading = document.createElement('h2');heading.textContent = 'Evidence ledger';article.append(heading);
    for (const item of paperReference.evidence) {
      const section = document.createElement('section');
      const title = document.createElement('h3');title.textContent = item.source;
      const observation = document.createElement('p');observation.textContent = item.preserve;
      const limit = document.createElement('p');limit.textContent = `Limits: ${item.limits}`;
      section.append(title,observation,limit);
      if (sourceURL) { const link = document.createElement('a');link.href = `${sourceURL}#page=${item.pdfPage}`;link.target = '_blank';link.rel = 'noreferrer';link.textContent = 'Inspect source figure or text';section.append(link); }
      article.append(section);
    }
  }
  if (index === 11) {
    const heading = document.createElement('h2');heading.textContent = 'Paper bibliography and context';article.append(heading);
    const list = document.createElement('ol');
    for (const item of paperReference.bibliography) {
      const row = document.createElement('li');row.textContent = `${item.authors} (${item.year}). ${item.title}. PDF p.${item.pdfPage}.`;
      list.append(row);
    }
    article.append(list);
    const note = document.createElement('p');note.textContent = 'These are references cited by the original paper; the cited papers have not been independently reviewed for this companion.';article.append(note);
    const thanks = document.createElement('p');thanks.textContent = `Original paper acknowledgements: ${paperReference.acknowledgements.people.join('; ')}.`;article.append(thanks);
  }
  if (index === 2 || index === 11) {
    const tableHeading = document.createElement('h2');tableHeading.textContent = 'Match each problem to its technique';article.append(tableHeading);
    for (const item of paperReference.table1) {
      const heading = document.createElement('h3');heading.textContent = `${item.problem} → ${item.technique}`;
      const p = document.createElement('p');p.textContent = `${item.paperAdvantage}. Boundary: ${item.caveat} ${item.source}.`;
      article.append(heading,p);
    }
  }
  annotateSymbols(article);
  courseControls.children[0].disabled = index === 0;
  courseControls.children[1].disabled = index === lessons.length - 1;
  for (const button of navigation.children) {
    if (Number(button.dataset.index) === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
}
lessons.forEach((lesson, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${index + 1}. ${lesson.title}`;
  button.dataset.index = index;
  button.addEventListener('click', () => showLesson(index));
  navigation.append(button);
});
const courseControls = document.createElement('div');
courseControls.className = 'controls';
for (const [label, delta] of [['Previous lesson', -1], ['Next lesson', 1]]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => showLesson(Math.max(0, Math.min(lessons.length - 1, lessonIndex + delta))));
  courseControls.append(button);
}
element('lesson').after(courseControls);
let resumed = 0;
try { resumed = Number(localStorage.getItem('dynamo-last-lesson') || 0); } catch { /* Start at the beginning. */ }
showLesson(Number.isInteger(resumed) && resumed >= 0 && resumed < lessons.length ? resumed : 0);

function drawGraph(known) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 600 340');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Causal version graph. D1 to D2, then branches D3 and D4, then reconciled D5. Only known versions shown.');
  const positions = [[300,35],[300,110],[150,195],[450,195],[300,285]];
  const edges = [[0,1],[1,2],[1,3],[2,4],[3,4]];
  for (const [from,to] of edges) {
    if (to >= known.length) continue;
    const line = document.createElementNS(namespace,'line');
    line.setAttribute('x1',positions[from][0]); line.setAttribute('y1',positions[from][1]+18);
    line.setAttribute('x2',positions[to][0]); line.setAttribute('y2',positions[to][1]-18);
    line.setAttribute('stroke','currentColor'); line.dataset.edge = `${from}-${to}`;
    svg.append(line);
  }
  known.forEach((version,index) => {
    const text = document.createElementNS(namespace,'text');
    text.setAttribute('x',positions[index][0]); text.setAttribute('y',positions[index][1]);
    text.setAttribute('text-anchor','middle'); text.setAttribute('fill','currentColor');
    text.textContent = version.id;
    svg.append(text);
    const clock = document.createElementNS(namespace,'text');
    clock.setAttribute('x',positions[index][0]); clock.setAttribute('y',positions[index][1]+16);
    clock.setAttribute('text-anchor','middle'); clock.setAttribute('fill','currentColor'); clock.setAttribute('font-size','14');
    clock.textContent = format(version.clock);svg.append(clock);
  });
  element('version-graph').replaceChildren(svg);
}

element('paper-file').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  if (sourceURL) URL.revokeObjectURL(sourceURL);
  sourceURL = URL.createObjectURL(file);
  element('paper-link').href = sourceURL;
  element('paper-link').hidden = false;
  showLesson(lessonIndex);
  element('paper-status').textContent = 'Local file attached. Use the PDF page references printed on each lesson.';
});
try { element('reading-note').value = localStorage.getItem('dynamo-reading-note') || ''; } catch { /* Optional local notes. */ }
element('save-note').addEventListener('click', () => {
  try {
    localStorage.setItem('dynamo-reading-note', element('reading-note').value);
    element('note-status').textContent = 'Saved locally in this browser.';
  } catch { element('note-status').textContent = 'Local storage unavailable; export your note instead.'; }
});
element('export-note').addEventListener('click', () => {
  const record = { paper: 'Dynamo, SOSP 2007', lesson: lessonIndex + 1,
    note: element('reading-note').value, interpretation: 'Self-reported note; navigation does not establish mastery.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
  const link = document.createElement('a');link.href = url;link.download = 'dynamo-reading.json';link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const paperMap = document.createElement('details');
const mapTitle = document.createElement('summary');mapTitle.textContent = 'Paper map — find an original section';paperMap.append(mapTitle);
for (const item of paperReference.coverage) {
  if (!item.lesson) continue;
  const link = document.createElement('button');link.type = 'button';
  link.textContent = `${item.section} · PDF ${item.pdfPages} → lesson ${item.lesson}`;
  link.addEventListener('click',()=>showLesson(item.lesson-1));paperMap.append(link);
}
element('reading-tools').parentElement.append(paperMap);
const searchLabel = document.createElement('label');searchLabel.textContent = 'Find a concept ';
const search = document.createElement('input');search.type = 'search';searchLabel.append(search);
const results = document.createElement('div');
search.addEventListener('input',()=>{
  results.replaceChildren();const query = search.value.trim().toLowerCase();if (!query) return;
  lessons.forEach((lesson,index)=>{
    if (!JSON.stringify([lesson,deepReading.lessons[index]]).toLowerCase().includes(query)) return;
    const link = document.createElement('button');link.type = 'button';link.textContent = `${index+1}. ${lesson.title}`;
    link.addEventListener('click',()=>showLesson(index));results.append(link);
  });
  if (!results.children.length) results.textContent = 'No matching lesson.';
});
element('reading-tools').parentElement.append(searchLabel,results);

const notation = document.createElement('details');
const notationTitle = document.createElement('summary');notationTitle.textContent = 'Shared notation reference';notation.append(notationTitle);
const meanings = document.createElement('dl');
for (const [symbol,meaning] of Object.entries(glossary)) { const term = document.createElement('dt');term.textContent = symbol;const definition = document.createElement('dd');definition.textContent = meaning;meanings.append(term,definition); }
notation.append(meanings);element('reading-tools').parentElement.append(notation);
