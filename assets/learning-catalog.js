export const projects = {
  'llm-systems': { title: 'Learning LLM Systems', tags: ['AI', 'LLM systems'] }
};

export const sites = {
  'math-fluency': { project: 'llm-systems', title: 'Mathematical Notation for Systems Engineers', path: '/labs/math-fluency/', tags: ['Mathematics', 'Attention'] },
  scion: { title: 'Source control, rethought', path: '/labs/scion/', tags: ['Distributed systems', 'Source control'] },
  inference: { project: 'llm-systems', title: 'LLM Inference: Foundations & KV Cache', path: '/labs/inference/', tags: ['Inference', 'KV cache'] },
  attention: { project: 'llm-systems', title: 'Attention Mechanisms & KV-Cache Internals', path: '/labs/attention/', tags: ['Attention', 'KV cache'] },
  kafka: { title: 'Kafka Design Reader', path: '/labs/kafka/', tags: ['Kafka', 'System design'] }
};

export function siteTags(project, site) {
  return [...new Set([...(project?.tags || []), ...(site.tags || [])])];
}
