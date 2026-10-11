export const lessons=[
{id:'inference',title:'LLM inference',label:'The execution engine',ready:true},
{id:'attention',title:'Attention from first principles',label:'Q, K, V · causal masking'},
{id:'cache',title:'Inside the KV cache',label:'Layouts · GQA · quantization'},
{id:'memory',title:'Memory & scheduling',label:'Paging · eviction · batching'},
{id:'engines',title:'vLLM & SGLang',label:'Read code · trace a request'},
{id:'benchmark',title:'Benchmarking',label:'TTFT · TPOT · goodput'},
{id:'research',title:'Research experiments',label:'Hypothesis → reproducible result'}];
export const sections=['Overview','Execution trace','Capacity lab','Prefix reuse','Checkpoint','Fieldnotes'];
export const questions=[
{q:'A 4,096-token prompt produces its first output token. Which phase supplied the logits?',a:['Prefill','The first decode pass','Prefix eviction'],correct:0,why:'The last prompt position produces logits during prefill. Sampling those logits yields output token 1. The next forward pass consumes that sampled token.'},
{q:'A cached 2,048-token prefix is reused. What happens to decode attention?',a:['It ignores those 2,048 tokens','It still reads their cached keys and values','It reuses a complete old answer'],correct:1,why:'Reuse saves prefix computation, not attention to the prefix. New queries still attend its K/V states. The answer depends on the suffix and generated history.'},
{q:'Change KV heads from 32 to 8, keeping layers, head dimension, precision and length fixed. Cache memory becomes…',a:['4× larger','Unchanged','One quarter'],correct:2,why:'KV bytes scale with KV heads. Query heads are not the cache head count; grouped-query attention can share K/V across query heads.'},
{q:'Two prompts contain the same paragraph, but one has a different first token. Can a simple exact-prefix cache reuse that paragraph?',a:['Yes, anywhere in either prompt','No: preceding causal context differs','Yes, if output length matches'],correct:1,why:'A token’s state depends on preceding context. Equal text at different contexts is not an interchangeable cache entry. Match tokens, positions, model and relevant execution configuration.'}];
