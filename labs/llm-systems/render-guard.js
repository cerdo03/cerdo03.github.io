// Run before body parsing. Deferred modules rebuild the reading shell and mount
// diagrams before DOMContentLoaded; reveal their final layout in one paint.
// Without JavaScript this class is never set. Failed modules still release it.
document.documentElement.classList.add('course-pending');
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.remove('course-pending');
}, { once: true });
