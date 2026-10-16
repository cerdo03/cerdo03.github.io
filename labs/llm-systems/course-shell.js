import {enhanceCourse} from './course-enhancements.js';
import '../attention/symbols.js';
import { equationContext, conceptTitle } from './course-context.js';
import { renderMathIn } from './math-renderer.js';
import { mountEquationExplorers } from './equation-explorer.js';
// Shared guided reading shell for this collection only. Existing URLs and section anchors remain valid.
const mathLessons = ['Notation grammar', 'Indices and reductions', 'Dimensions and transpose', 'Softmax and stability', 'Transformer equations', 'Write equations'];
const lessons = ['Self-attention', 'Multi-head attention', 'MHA / MQA / GQA', 'KV-cache internals', 'Memory and performance'];
export function sectionIndex(ids, hash) { const index = ids.indexOf(hash.replace(/^#/, '')); return index < 0 ? 0 : index; }

function labelDiagram(root) {
  const doc = root.ownerDocument, walker = doc.createTreeWalker(root, 4), texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  for (const text of texts) {
    const parts = text.textContent.split(/(\b(?:WQ|WK|WV|WO|HKV|Q|K|V|L|T|D|B|N|x)\b)/g);
    if (parts.length === 1) continue;
    const fragment = doc.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2 === 0) fragment.append(doc.createTextNode(part));
      else {
        const variable = doc.createElement('var');variable.textContent = part === 'HKV' ? 'H' : part.startsWith('W') ? 'W' : part;fragment.append(variable);
        if (part === 'HKV' || part.startsWith('W')) { const sub = doc.createElement('sub');sub.textContent = part === 'HKV' ? 'KV' : part[1];fragment.append(sub); }
      }
    });text.replaceWith(fragment);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded',()=>{ enhanceCourse(document);renderMathIn(document);mountEquationExplorers(document); },{once:true});
  const inference = !!document.getElementById('curriculum');
  const number = Number(document.body.dataset.lesson);
  const mathNumber = Number(document.body.dataset.mathLesson);
  const currentNumber = mathNumber || number;
  const mathPage = location.pathname.includes('/math-fluency/');
  const mathSearch = equationContext(location.search);
  const sections = currentNumber ? [...document.querySelectorAll('main > section[id]')] : [];
  const navigationKey = 'llm-course-navigation-v1';
  let navigation = {};
  try { navigation = JSON.parse(localStorage.getItem(navigationKey)) || {}; } catch { /* Optional storage. */ }
  const rememberDisclosure = (detail, key, fallback) => {
    const initial = typeof navigation[key] === 'boolean' ? navigation[key] : fallback;
    detail.open = initial;
    detail.addEventListener('toggle', () => { if (detail.open === initial && typeof navigation[key] !== 'boolean') return;navigation[key] = detail.open;try { localStorage.setItem(navigationKey, JSON.stringify(navigation)); } catch { /* Optional storage. */ } });
  };
  let sidebar = document.querySelector('aside');
  if (!sidebar) { sidebar = document.createElement('aside');document.querySelector('main').before(sidebar); }
  document.body.classList.add('llm-course');
  if (!document.querySelector('.skip-link')) { const skip = document.createElement('a');skip.className = 'skip-link';skip.href = '#main';skip.textContent = 'Skip to lesson content';document.body.prepend(skip);document.querySelector('main').id ||= 'main'; }
  document.querySelector('.skip-link').onclick = event => { event.preventDefault();const main = document.querySelector('main');main.tabIndex = -1;main.focus();window.scrollTo(0, 0); };
  if (sidebar) {
    sidebar.className = 'course-sidebar';
    let nav;
    const curriculum = document.getElementById('curriculum');
    sidebar.replaceChildren();
    if (inference || sections.length) {
    const current = document.createElement('details');
    rememberDisclosure(current, 'concepts', !window.matchMedia('(max-width: 900px)').matches);
    const summary = document.createElement('summary');
    summary.textContent = 'Concepts';
    current.append(summary);
    nav = inference ? curriculum : document.createElement('nav');
    if (!inference) nav.setAttribute('aria-label', 'Concepts');
    current.append(nav);
    sidebar.append(current);
    }
    const modules = document.createElement('details');
    modules.className = 'course-modules';
    rememberDisclosure(modules, 'modules', false);
    const title = document.createElement('summary');title.textContent = 'Modules';modules.append(title);
    const links = document.createElement('nav');links.setAttribute('aria-label', 'Modules');
    links.innerHTML = '<ul><li><a href="../math-fluency/">0. Optional math toolkit</a><ul>' + mathLessons.map((text, i) => `<li><a href="../math-fluency/lesson-${i + 1}.html${mathPage ? mathSearch : ''}">0.${i + 1} ${text}</a></li>`).join('') + '</ul></li><li><a href="../inference/">1. Inference fundamentals</a></li><li><a href="../attention/">2. Attention and KV cache</a><ul>' + lessons.map((text, i) => `<li><a href="../attention/lesson-${i + 1}.html">2.${i + 1} ${text}</a></li>`).join('') + '</ul></li></ul>';
    const active = mathNumber ? `../math-fluency/lesson-${mathNumber}.html${mathSearch}` : location.pathname.includes('/math-fluency/') ? '../math-fluency/' : inference ? '../inference/' : number ? `../attention/lesson-${number}.html` : !location.pathname.includes('llm-systems') ? '../attention/' : null;
    if (active) [...links.querySelectorAll('a')].find(link => link.getAttribute('href') === active)?.setAttribute('aria-current', 'page');
    modules.append(links);sidebar.prepend(modules);
    if (sections.length) {
      const main = document.querySelector('main');
      const hero = main.querySelector(':scope > header');
      hero?.classList.add('course-intro');
      main.querySelector('.pager')?.remove();
      if (!mathNumber && number === 2) {
        const introSection = sections[0], figure = document.createElement('div');figure.className = 'lab';
        figure.innerHTML = '<p>Every head receives the same incoming token vector x. Its own learned matrices create its Q, K and V.</p><div class="mechanism-node"><strong>Same incoming x</strong><span>One token position</span></div><div class="connector">↓ parallel projections</div><div class="node-grid"><div class="mechanism-node"><strong>Head 1</strong>x × WQ₁ → Q₁<br>x × WK₁ → K₁<br>x × WV₁ → V₁<br>↓ its weights mix its V rows<br>Head result 1</div><div class="mechanism-node"><strong>Head 2</strong>x × WQ₂ → Q₂<br>x × WK₂ → K₂<br>x × WV₂ → V₂<br>↓ its weights mix its V rows<br>Head result 2</div></div><div class="connector">↓ concatenate the head results, then output projection</div><div class="mechanism-node"><strong>One update for this token</strong>Add to its incoming vector (residual addition). Q/K/V are intermediate vectors, not the next layer’s input.</div>';
        labelDiagram(figure);introSection.querySelector('p').after(figure);
      }
      if (!mathNumber && number === 2) {
        const split = document.createElement('div');split.className = 'lab';
        split.innerHTML = '<div class="mechanism-node"><strong>After Q projection: 4 components</strong>[head1·a, head1·b, head2·a, head2·b]</div><div class="connector">↓ split the projected columns</div><div class="node-grid"><div class="mechanism-node"><strong>Head 1 gets 2 components</strong>[head1·a, head1·b]</div><div class="mechanism-node"><strong>Head 2 gets 2 components</strong>[head2·a, head2·b]</div></div><p>This split happens after projection. Both heads started from the same full input x; they do not receive disjoint slices of the original embedding. K and V split in the same way.</p>';
        labelDiagram(split);sections[1].querySelector('p').after(split);
        const join = document.createElement('div');join.className = 'lab';
        join.innerHTML = '<div class="node-grid"><div class="mechanism-node"><strong>Head result 1</strong>2 components</div><div class="mechanism-node"><strong>Head result 2</strong>2 components</div></div><div class="connector">↓ concatenate: place components next to each other</div><div class="mechanism-node"><strong>Joined result</strong>2 + 2 = 4 components</div><div class="connector">↓ learned output projection WO mixes the head results</div><div class="mechanism-node"><strong>One 4-component update</strong>Add this to the incoming 4-component x. This residual addition preserves the original path while incorporating the attention update.</div>';
        labelDiagram(join);sections[3].querySelector('p').after(join);
      }
      if (!mathNumber && number === 5) {
        const counts = document.createElement('div');counts.className = 'lab';
        counts.innerHTML = '<div class="mechanism-node"><strong>One token, one KV head, one layer</strong>One K vector + one V vector → 2 × D numbers.<br>Each number takes B bytes → 2 × D × B bytes.</div><div class="connector">↓ repeat for all KV heads</div><div class="mechanism-node"><strong>One token, one layer</strong>2 × HKV × D × B bytes</div><div class="connector">↓ repeat for L layers and T cached positions</div><div class="mechanism-node"><strong>One sequence’s raw KV memory</strong>2 × L × T × HKV × D × B bytes.<br>For N equal-length sequences, multiply by N.</div><p>Queries are not stored in the KV cache, so the number of query heads does not appear in this formula. The calculator applies these counts to a configuration; its chart uses that same configuration.</p>';
        labelDiagram(counts);sections[0].querySelector('p').after(counts);
      }
      // Main reading path: one intuition paragraph and the useful illustration. Preserve depth in place.
      const fold = (nodes, label, host) => {
        if (!nodes.length) return;
        const detail = document.createElement('details');detail.className = 'course-detail';
        const summary = document.createElement('summary');summary.textContent = label;
        const body = document.createElement('div');detail.append(summary, body);
        nodes[0].before(detail);nodes.forEach(node => body.append(node));
        if (host) host.append(detail);
      };
      if (!mathNumber && hero?.querySelector('.callout')) fold([hero.querySelector('.callout')], 'Prerequisites and assumptions');
      if (!mathNumber) sections.forEach(section => {
        const children = [...section.children];
        const intro = children.find(child => child.tagName === 'P');
        const labs = children.filter(child => child.classList.contains('lab'));
        const keep = number === 1 ? labs.filter(lab => lab.classList.contains('shared-attention')) : labs.length ? labs : children.filter(child => child.tagName === 'FIGURE');
        keep.push(...children.filter(child => child.classList.contains('course-core')));
        const depth = children.filter(child => child.tagName !== 'H2' && child !== intro && !child.classList.contains('shared-example-title') && !keep.includes(child) && child.tagName !== 'DETAILS');
        if (!section.id.endsWith('check')) fold(depth, number === 1 ? 'Detailed derivation and alternate worked example' : 'Technical detail', section);
        section.querySelectorAll('.lab-assumptions').forEach(note => fold([note], 'Example assumptions'));
      });
      const buttons = sections.map((section, i) => {
        const button = document.createElement('button');button.type = 'button';
        button.textContent = `${i + 1}. ${conceptTitle(section.querySelector('h2')?.textContent || '') || 'Check your understanding'}`;
        button.onclick = () => show(i, true);nav.append(button);return button;
      });
      const pager = document.createElement('nav');pager.className = 'course-pager';pager.setAttribute('aria-label', 'Previous and next concept');
      pager.innerHTML = '<button type="button" data-prev>← Previous concept</button><button type="button" data-next>Next concept →</button>';
      main.append(pager);
      const counter = document.createElement('p');counter.className = 'course-position';sections[0].before(counter);
      let index = sectionIndex(sections.map(s => s.id), location.hash);
      function show(i, moveFocus) {
        index = i;
        sections.forEach((section, j) => { section.hidden = j !== i; });
        buttons.forEach((button, j) => { button.setAttribute('aria-current', j === i ? 'step' : 'false'); });
        if (hero) hero.hidden = i !== 0;
        const heading = sections[i].querySelector('h2');heading.tabIndex = -1;
        if (heading.firstChild?.nodeType === 3) heading.firstChild.textContent = conceptTitle(heading.firstChild.textContent);
        counter.textContent = `${i + 1} / ${sections.length}`;
        pager.querySelector('[data-prev]').disabled = i === 0 && currentNumber === 1;
        pager.querySelector('[data-next]').textContent = i === sections.length - 1 ? (currentNumber === (mathNumber ? 6 : 5) ? 'Module overview →' : 'Next lesson →') : `Next: ${buttons[i + 1].textContent.replace(/^\d+\.\s*/, '')} →`;
        history.replaceState(null, '', `#${sections[i].id}`);
        if (moveFocus) { heading.focus();window.scrollTo(0, 0); }
        document.dispatchEvent(new CustomEvent('course:section', { detail: sections[i].id }));
      }
      pager.querySelector('[data-prev]').onclick = () => {
        if (index > 0) show(index - 1, true); else location.href = `lesson-${currentNumber - 1}.html${mathPage ? mathSearch : ''}`;
      };
      pager.querySelector('[data-next]').onclick = () => {
        if (index < sections.length - 1) show(index + 1, true); else location.href = currentNumber === (mathNumber ? 6 : 5) ? `./${mathPage ? mathSearch : ''}` : `lesson-${currentNumber + 1}.html${mathPage ? mathSearch : ''}`;
      };
      window.addEventListener('hashchange', () => { if (sections.some(s => `#${s.id}` === location.hash)) show(sectionIndex(sections.map(s => s.id), location.hash), true); });
      show(index, false);
    }
  }
  for (const link of document.querySelectorAll('footer a')) { if (/Back to the journal/i.test(link.textContent)) link.href = 'https://cerdo03.github.io/';if (/Back to learning sites/i.test(link.textContent)) link.href = 'https://cerdo03.github.io/#sites'; }
  if (!currentNumber && !inference && !location.pathname.includes('llm-systems')) {
    for (const id of ['goal', 'prerequisites', 'notation', 'references']) {
      const section = document.getElementById(id);if (!section) continue;
      const detail = document.createElement('details');detail.className = 'course-detail';
      const summary = document.createElement('summary');summary.textContent = section.querySelector('h2').textContent;
      section.querySelector('h2').remove();section.replaceWith(detail);detail.append(summary, section);
    }
  }
  const existingHeader = inference ? document.querySelector('main > header') : document.querySelector('.site-header');
  if (existingHeader) {
    const themeButton = document.querySelector('[data-theme-toggle], [data-appearance-toggle]') || [...document.querySelectorAll('button')].find(b => /mode$/.test(b.textContent.trim()));
    existingHeader.className = 'course-header';
    document.querySelector('main')?.prepend(existingHeader);
    existingHeader.replaceChildren();
    const home = document.createElement('a');home.href = '../llm-systems/';home.textContent = 'Learning LLM Systems';existingHeader.append(home);
    const context = document.createElement('span');context.textContent = mathNumber ? `Mathematical notation · ${mathLessons[mathNumber - 1]}` : location.pathname.includes('/math-fluency/') ? 'Optional math toolkit' : inference ? 'Inference fundamentals' : number ? `Attention · ${lessons[number - 1]}` : location.pathname.includes('llm-systems') ? 'Modules' : 'Attention and KV cache';existingHeader.append(context);
    if (themeButton) existingHeader.append(themeButton);
    if (!themeButton) { const observer = new MutationObserver(() => { const toggle = document.querySelector('.theme-toggle');if (toggle) { if (toggle.parentElement !== existingHeader) existingHeader.append(toggle);observer.disconnect(); } });observer.observe(document.body, {childList: true, subtree: true}); }
  }
}
