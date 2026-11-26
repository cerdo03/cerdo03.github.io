// Sections that moved between lessons keep working: an old deep link jumps to the lesson that now holds it.
const moved = { '/gpu/lesson-1.html': { '#dependencies': 'lesson-5.html#dependencies' }, '/gpu/lesson-3.html': { '#attention-link': 'lesson-5.html#attention-link' } };
const target = moved[Object.keys(moved).find(path => location.pathname.endsWith(path))]?.[location.hash];
if (target) location.replace(target);
