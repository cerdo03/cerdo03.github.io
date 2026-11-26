// Source of truth for published learning sites. Only list sites that are live.
// A project is a collection (course, paper or research topic) with its own landing page;
// sites without `project` are standalone and link directly from the homepage.
//   kind     type badge shown on cards
//   summary  one or two sentences, honest about scope (simulation vs measurement)
//   label    position inside a collection (module number or "Optional")
export const projects = {
  'llm-systems': {
    title: 'Learning LLM Systems',
    path: '/labs/llm-systems/',
    kind: 'Collection',
    summary: 'My ongoing study of how language models generate text, reuse computation and serve requests: the KV cache, attention math, GPUs and efficient attention.',
    tags: ['AI', 'LLM systems']
  }
};

export const sites = {
  'math-fluency': { project: 'llm-systems', title: 'Mathematical Notation for Systems Engineers', path: '/labs/math-fluency/', kind: 'Optional toolkit', label: 'Module 0', summary: 'Six short lessons on notation, indices, tensor shapes and stable softmax.', tags: ['Mathematics', 'Attention'] },
  inference: { project: 'llm-systems', title: 'LLM Inference: Foundations & KV Cache', path: '/labs/inference/', kind: 'Interactive guide', label: 'Module 1', summary: 'Tokens, prefill, decode and the KV cache through simplified diagrams; no real model runs.', tags: ['Inference', 'KV cache'] },
  attention: { project: 'llm-systems', title: 'Attention Mechanisms & KV-Cache Internals', path: '/labs/attention/', kind: 'Interactive module', label: 'Module 2', summary: 'Derive scaled dot-product attention, trace MHA, MQA and GQA shapes, and size the KV cache.', tags: ['Attention', 'KV cache'] },
  gpu: { project: 'llm-systems', title: 'GPU Architecture and Performance Engineering', path: '/labs/gpu/', kind: 'Five lessons', label: 'Module 3', summary: 'Threads, memory, tiling and roofline models to compare prefill and decode; analytical, not measured.', tags: ['GPU', 'Performance', 'Inference'] },
  'efficient-attention': { project: 'llm-systems', title: 'Efficient Attention and Memory', path: '/labs/efficient-attention/', kind: 'Five lessons', label: 'Module 4', summary: 'Online softmax, tile IO, block tables and copy-on-write as computed teaching models.', tags: ['Attention', 'Memory', 'Inference'] },
  'architecture-explorer': { project: 'llm-systems', title: 'Transformer Architecture Explorer', path: '/labs/attention/architecture-explorer/', kind: 'Visual companion', label: 'Optional', summary: 'A causal decoder in 3D with Q/K/V, head sharing and tensor shapes; a schematic, not a model.', tags: ['Attention', '3D'] },
  dynamo: { title: 'Dynamo Paper Companion', path: '/labs/dynamo/', kind: 'Paper companion', summary: 'The 2007 Dynamo paper through replica placement, version histories and failure experiments.', tags: ['Distributed systems', 'Storage', 'Research paper'] },
  kafka: { title: 'Kafka Design Reader', path: '/labs/kafka/', kind: 'Interactive guide', summary: 'Partitions, offsets, replication and delivery guarantees, after Chirag Hasija’s message-queue design.', tags: ['Kafka', 'System design'] },
  scion: { title: 'Source control, rethought', path: '/labs/scion/', kind: 'Interactive guide', summary: 'Follow one code change through content-addressed storage and cache tiers, after Anthropic’s Scion article.', tags: ['Distributed systems', 'Source control'] }
};

export function siteTags(project, site) {
  return [...new Set([...(project?.tags || []), ...(site.tags || [])])];
}

// Homepage entries in display order: the collection first, then standalone sites.
export function entries() {
  const standalone = Object.entries(sites).filter(([, site]) => !site.project).map(([id, site]) => ({ id, type: 'site', ...site, tags: siteTags(null, site) }));
  const collections = Object.entries(projects).map(([id, project]) => {
    const members = Object.entries(sites).filter(([, site]) => site.project === id).map(([siteId, site]) => ({ id: siteId, ...site, tags: siteTags(project, site) }));
    const tags = [...new Set([...project.tags, ...members.flatMap(member => member.tags)])];
    return { id, type: 'collection', ...project, members, tags };
  });
  return [...collections, ...standalone];
}

// Which entries (and, inside a collection, which member sites) carry a tag. No tag = everything.
export function matchTag(tag) {
  return entries().map(entry => {
    const memberIds = entry.type === 'collection' ? entry.members.filter(member => !tag || member.tags.includes(tag)).map(member => member.id) : [];
    const matches = !tag || (entry.type === 'collection' ? memberIds.length > 0 || entry.tags.includes(tag) : entry.tags.includes(tag));
    return { id: entry.id, matches, memberIds };
  });
}

// Topic list for the filter: every tag with the number of published sites carrying it, most common first.
export function tagCounts() {
  const counts = new Map();
  for (const site of Object.values(sites)) for (const tag of siteTags(projects[site.project], site)) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}
