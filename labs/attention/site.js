// Shared page behaviour for Module 2: visited markers, resume link, current-section TOC marker.
// Progress is an optional per-browser convenience stored in localStorage; every access is
// wrapped so the pages work normally when storage is unavailable. No points or scores.

const STORAGE_KEY = 'attention-module-progress-v1';

function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      visited: Array.isArray(parsed.visited) ? parsed.visited.filter(Number.isInteger) : [],
      last: parsed.last && typeof parsed.last.href === 'string' ? parsed.last : null,
    };
  } catch {
    return { visited: [], last: null };
  }
}

function writeProgress(progress) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Progress is optional. */ }
}

const progress = readProgress();
const lesson = Number(document.body.dataset.lesson) || null;

if (lesson && !progress.visited.includes(lesson)) {
  progress.visited.push(lesson);
  progress.visited.sort((a, b) => a - b);
}
if (lesson) {
  progress.last = { lesson, section: null, title: `Lesson 2.${lesson}: ${document.querySelector('main h1')?.textContent.trim() || ''}`, href: `lesson-${lesson}.html` };
  writeProgress(progress);
}

// Text markers (not colour-only) for visited lessons in the lesson navigation.
for (const link of document.querySelectorAll('.lesson-nav a[data-lesson]')) {
  const n = Number(link.dataset.lesson);
  if (progress.visited.includes(n) && n !== lesson && !link.querySelector('.visited-marker')) {
    link.append(Object.assign(document.createElement('span'), { className: 'visited-marker', textContent: ' · visited' }));
  }
}

// Resume link on the module overview.
const resume = document.getElementById('resume');
if (resume && progress.last) {
  const link = document.createElement('a');
  link.href = progress.last.section ? `${progress.last.href}#${progress.last.section}` : progress.last.href;
  link.textContent = progress.last.sectionTitle ? `${progress.last.title} — ${progress.last.sectionTitle}` : progress.last.title;
  resume.replaceChildren('Resume where you left off: ', link);
  resume.hidden = false;
}

// On narrow screens start with the in-page contents collapsed so the lesson comes first.
const tocDetails = document.querySelector('.toc-details');
if (tocDetails && window.matchMedia?.('(max-width: 900px)').matches) tocDetails.open = false;

// Current section: mark the TOC link and remember it for resume.
const sections = [...document.querySelectorAll('main section[id^="s2-"]')];
const tocLinks = new Map([...document.querySelectorAll('.toc a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]));

function setCurrent(section) {
  for (const [id, a] of tocLinks) {
    if (id === section.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  }
  if (lesson) {
    progress.last = { ...progress.last, section: section.id, sectionTitle: section.querySelector('h2')?.textContent.trim() || section.id };
    writeProgress(progress);
  }
}

if (sections.length && 'IntersectionObserver' in window) {
  const visible = new Set();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
    }
    const first = sections.find((s) => visible.has(s));
    if (first) setCurrent(first);
  }, { rootMargin: '0px 0px -60% 0px' });
  sections.forEach((s) => observer.observe(s));
}
