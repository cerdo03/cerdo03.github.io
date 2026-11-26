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
    summary: 'My ongoing study of how language models generate text, reuse computation and serve requests: tokens and KV cache, attention math, GPUs and efficient attention.',
    tags: ['AI', 'LLM systems']
  }
};

export const sites = {
  'math-fluency': { project: 'llm-systems', title: 'Mathematical Notation for Systems Engineers', path: '/labs/math-fluency/', kind: 'Optional toolkit', label: 'Module 0', summary: 'Six short lessons on notation, indices, tensor shapes and stable softmax, so the attention equations read easily.', tags: ['Mathematics', 'Attention'] },
  inference: { project: 'llm-systems', title: 'LLM Inference: Foundations & KV Cache', path: '/labs/inference/', kind: 'Interactive guide', label: 'Module 1', summary: 'Tokens, prefill, decode, attention, cache memory and prefix reuse through simplified interactive diagrams. Nothing here runs a real model.', tags: ['Inference', 'KV cache'] },
  attention: { project: 'llm-systems', title: 'Attention Mechanisms & KV-Cache Internals', path: '/labs/attention/', kind: 'Interactive module', label: 'Module 2', summary: 'Derive scaled dot-product attention, trace shapes through MHA, MQA and GQA, and calculate what the KV cache stores. Toy numbers, raw storage only.', tags: ['Attention', 'KV cache'] },
  gpu: { project: 'llm-systems', title: 'GPU Architecture and Performance Engineering', path: '/labs/gpu/', kind: 'Five lessons', label: 'Module 3', summary: 'Map work to threads and memory, derive tiled matrix traffic, then compare prefill and decode with roofline models. Analytical, not measured.', tags: ['GPU', 'Performance', 'Inference'] },
  'efficient-attention': { project: 'llm-systems', title: 'Efficient Attention and Memory', path: '/labs/efficient-attention/', kind: 'Five lessons', label: 'Module 4', summary: 'Online softmax, attention tile residency and IO, then KV block tables, sharing and copy-on-write. Computed teaching models, no GPU speedup claimed.', tags: ['Attention', 'Memory', 'Inference'] },
  'architecture-explorer': { project: 'llm-systems', title: 'Transformer Architecture Explorer', path: '/labs/attention/architecture-explorer/', kind: 'Visual companion', label: 'Optional', summary: 'Open a causal decoder in 3D, trace Q/K/V and head sharing, and inspect tensor shapes. A schematic; it runs no pretrained model.', tags: ['Attention', '3D'] },
  dynamo: { title: 'Dynamo Paper Companion', path: '/labs/dynamo/', kind: 'Paper companion', summary: 'The 2007 Dynamo paper through replica placement, version histories, failure and repair experiments. Simulations are labelled apart from the paper’s measurements.', tags: ['Distributed systems', 'Storage', 'Research paper'] },
  kafka: { title: 'Kafka Design Reader', path: '/labs/kafka/', kind: 'Interactive guide', summary: 'Partitions, consumer offsets, replication and delivery guarantees, following Chirag Hasija’s “Design a Distributed Message Queue”.', tags: ['Kafka', 'System design'] },
  scion: { title: 'Source control, rethought', path: '/labs/scion/', kind: 'Interactive guide', summary: 'Follow one code change through content-addressed storage, sparse checkouts and cache tiers, then break it with competing writes. Companion to Anthropic’s Scion article.', tags: ['Distributed systems', 'Source control'] }
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
