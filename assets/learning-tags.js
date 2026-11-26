import { projects, sites, siteTags } from './learning-catalog.js';

// Fills [data-learning-site] / [data-learning-project] containers with tag chips from the catalog.
// Static fallback text inside the container is replaced once this module runs.
for (const element of document.querySelectorAll('[data-learning-site], [data-learning-project]')) {
  const site = sites[element.dataset.learningSite];
  const project = projects[element.dataset.learningProject || site?.project];
  const tags = site ? siteTags(project, site) : project?.tags || [];
  const list = document.createElement('ul');
  list.className = 'chip-list';
  for (const tag of tags) {
    const item = document.createElement('li');
    item.className = 'chip';
    item.textContent = tag;
    list.append(item);
  }
  element.replaceChildren(list);
}
