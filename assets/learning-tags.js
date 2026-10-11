import { projects, sites, siteTags } from './learning-catalog.js';

for (const element of document.querySelectorAll('[data-learning-site], [data-learning-project]')) {
  const site = sites[element.dataset.learningSite];
  const project = projects[element.dataset.learningProject || site?.project];
  element.textContent = (site ? siteTags(project, site) : project?.tags || []).join(' · ');
}
