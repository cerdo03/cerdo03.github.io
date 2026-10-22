const card = (label, title, body, state = '') => `<div class="node ${state}"><span class="badge">${label}</span><strong>${title}</strong>${body}</div>`;
const flow = (...nodes) => `<div class="flow ${nodes.length === 2 ? 'two' : ''}">${nodes.join('')}</div>`;
const p = text => `<p>${text}</p>`;
const files = (...items) => items.map(item => `<span class="file">${item}</span>`).join('');
const frame = (title, diagram, caption) => ({ title, diagram, caption });
const source = 'https://www.anthropic.com/engineering/redesigning-source-control';
const git = 'https://git-scm.com/book/en/v2/Git-Internals-Git-Objects';

export const lessons = [
  {
    id: 'repo', presentation: 'comparison', name: 'Start with one job', title: 'A test needs code to run.',
    intro: 'Imagine a small online shop. Its repository is the folder of code plus its saved history. A test job is a temporary program that checks whether the code works.',
    frames: [
      frame('Meet our shop repository', flow(card('Repository', 'shop/', files('checkout/pay.go', 'catalog/items.go', 'docs/help.md'), 'active'), card('Test job', 'Check payment code', p('Needs checkout/pay.go.<br>Does not need the help page.'))), 'Follow checkout/pay.go throughout this guide. Our imaginary payment test needs just that file; real tests often need dependencies too.'),
      frame('Choose a saved version', flow(card('Saved version A', 'fee = 5', p('The old payment rule.')), card('Saved version B', 'fee = 7', p('The new rule we want to test.'), 'active')), 'A version identifies which code to use. “Get the payment file” is incomplete: the test must ask for a particular version.'),
      frame('Place the selected file on disk', flow(card('Repository', 'Version B', files('checkout/pay.go → fee = 7')), card('Test job’s disk', 'checkout/pay.go', p('fee = 7<br>Ready to run the test.'), 'active')), 'Checkout means making the selected version’s files available to a program. That preparation costs work before the test itself even starts.')
    ],
    takeaway: 'Keep two things separate: storing the history, and preparing files for one job.',
    depthTitle: 'What is a commit? What is a monorepo?',
    depth: '<p>A commit records a saved project state and its history relationship. A monorepo keeps code for multiple components in one repository. It does not mean every job needs every component.</p><p>In Git, a commit points to a tree describing a snapshot. Unchanged file content can be reused. A snapshot does not mean copying every byte again.</p>',
    note: 'Foundation: Git’s object model.', url: git
  },
  {
    id: 'workload', presentation: 'comparison', name: 'Find the wasted work', title: 'Repeat that preparation.',
    intro: 'A setup that feels cheap once can become expensive when many short-lived jobs repeat it. Start by asking what each job actually needs.',
    frames: [
      frame('One job, one payment test', flow(card('Input', 'One saved version', p('The payment file is needed.')), card('Job 1', 'Prepare → test', p('Preparation happens before useful work.'), 'active')), 'Our example has a single job. There is little repeated work to share yet.'),
      frame('Three jobs ask for the same version', flow(card('Job 1', 'Prepare → test', p('Same payment file.')), card('Job 2', 'Prepare → test', p('Same payment file.')), card('Job 3', 'Prepare → test', p('Same payment file.'))), 'Each job needs a usable file. But transferring the same contents separately from distant storage is not necessarily required.'),
      frame('Make the service do shared work', flow(card('Jobs', 'Ask a specific question', p('“Give me this file at B.”')), card('Source service', 'Find once, reuse copies', p('History can stay behind the service API.'), 'active')), 'An API is a way for a program to request an operation. A job asking for a diff—the changes between versions—might need an answer, not files on disk.')
    ],
    takeaway: 'Design around the requests your users make, not only the size of the repository.',
    depthTitle: 'Does this mean Git is unsuitable?',
    depth: '<p>No. Git supports workflows where local history and offline work are valuable. Partial and shallow clones can reduce downloads. The lesson is to measure repeated work before changing architecture.</p><p>A service-based design trades local independence for reliance on network and service availability. These are requirements to weigh, not free improvements.</p>',
    note: 'Scion puts history operations on servers and assumes online clients.', url: source
  },
  {
    id: 'objects', name: 'Give content an identity', title: 'A filename can change. An object cannot.',
    intro: 'Keep a permanent object for each piece of content. Its identifier comes from its contents. This is called content addressing.',
    frames: [
      frame('The original payment contents', flow(card('File at A', 'checkout/pay.go', p('fee = 5')), card('Stored object', 'Object P5', p('fee = 5<br>Permanent contents.'), 'active')), 'P5 is a readable teaching label, not a real hash. A hash is a computed fingerprint used as an identifier.'),
      frame('An edit creates a different object', flow(card('Old object P5', 'fee = 5', p('Still available for A.')), card('New object P7', 'fee = 7', p('Used by the new version B.'), 'active')), 'We do not replace P5’s contents. B refers to P7, while A continues to refer to P5.'),
      frame('A cached old object is still correct', flow(card('Cached copy', 'P5 → fee = 5', p('Correct for a request for P5.')), card('New request', 'Give me P7', p('P5 cannot answer this request.'), 'active')), 'A cache is a nearby copy used to avoid fetching again. Keeping P5 does not make it a valid answer for P7. Object identity keeps the two versions separate.')
    ],
    takeaway: 'Same object ID → same contents. A newer version asks for a different ID.',
    depthTitle: 'What still changes?',
    depth: '<p>A name like “main” can point to different saved versions over time. Immutable file content does not make that name immutable. We will handle that distinction in step 8.</p><p>Git also uses content-addressed objects. This idea is not unique to Scion. Actual systems need integrity checks, permissions and object-retention policies; these are omitted from this toy model.</p>',
    note: 'Scion uses content-addressed data; Git does too.', url: source
  },
  {
    id: 'changes', name: 'Record a small change', title: 'Save what changed.',
    intro: 'Our developer edits only the payment rule. The other two files stay exactly as they were. We can describe the new version relative to the old one.',
    frames: [
      frame('Start from saved version A', flow(card('A: file mapping', 'Three files', files('pay.go → P5', 'items.go → I1', 'help.md → H1'), 'active'), card('Object store', 'Permanent contents', files('P5: fee = 5', 'I1: item code', 'H1: help text'))), 'The file mapping tells us which stored contents belong at each path. Names are shortened here; pay.go remains inside checkout/.'),
      frame('Store the new payment contents', flow(card('Object store', 'Add P7', files('P5: fee = 5 — retained', 'P7: fee = 7 — new'), 'active'), card('Other objects', 'Reuse I1 and H1', p('No content change.'))), 'Only the payment contents are new. Retaining P5 lets us still recover the older version.'),
      frame('Record B relative to A', flow(card('Change record B', 'Parent: A', files('checkout/pay.go → P7'), 'active'), card('B’s complete view', 'Resolve unchanged paths via A', files('pay.go → P7', 'items.go → I1', 'help.md → H1'))), 'The change record is small; the complete file view still contains three paths. A change record and a full view answer different questions.')
    ],
    takeaway: 'A small edit can produce a small record, while still defining a complete version.',
    depthTitle: 'How does this differ from a Git commit?',
    depth: '<p>A Git commit points to a snapshot tree. The toy record here names a parent and changed paths instead. Both can reuse existing file objects; neither requires re-uploading every unchanged file.</p><p>Following parents repeatedly could make reads expensive. An additional index can help—that is the next idea. File deletion, renames and merges are outside this example.</p>',
    note: 'Scion changesets record changed files relative to their first parent, in a write-ahead log.', url: source
  },
  {
    id: 'indexes', presentation: 'comparison', name: 'Build answers from records', title: 'One record. Several useful views.',
    intro: 'Suppose you ask: “Which changes touched the payment file?” We could inspect every change record—or prepare a lookup table for that question.',
    frames: [
      frame('The saved facts', flow(card('A', 'Initial files', p('Includes pay.go.')), card('B', 'Change payment fee', p('Touches pay.go.'), 'active'), card('C', 'Edit help text', p('Touches help.md.'))), 'The history is A → B → C. Only A and B contain changes affecting the payment file.'),
      frame('Build a path-history index', flow(card('Read change records', 'A, then B, then C', p('Collect the affected paths.')), card('Derived lookup', 'pay.go → A, B', p('help.md → A, C'), 'active')), 'An index is an extra structure that makes a particular lookup cheaper. “Derived” means computed from already stored facts.'),
      frame('Answer without scanning all records', flow(card('Question', 'Who touched pay.go?', p('Look up this path.')), card('Index answer', 'A and B', p('C is not relevant.'), 'active')), 'Preparing this answer earlier saves repeated scanning later. The extra structure costs storage and computation of its own.')
    ],
    takeaway: 'Keep the underlying facts; build extra views to make important questions cheap.',
    depthTitle: 'Compute ahead of time or when asked?',
    depth: '<p>Eager computation prepares an index before a reader asks. It adds work earlier but can make reads predictable. Lazy computation waits until the information is needed; the first reader may pay the cost.</p><p>Recoverability needs more than calling data “derived”: retained inputs, a reproducible computation and enough rebuild capacity matter. This guide does not specify Scion’s recovery protocol.</p>',
    note: 'Scion derives indexes recursively from parents; computation can be eager or deferred.', url: source
  },
  {
    id: 'sparse', name: 'Fetch only what is needed', title: 'Leave the help page behind.',
    intro: 'Return to our payment test at version B. It needs checkout/pay.go. Walk the directory structure to find the right object, then fetch its contents.',
    frames: [
      frame('Start with the root directory', flow(card('B: root tree', 'Directory map', files('checkout/ → payment tree', 'catalog/ → item tree', 'docs/ → help tree'), 'active'), card('Job request', 'checkout/pay.go at B', p('Only this path is needed.'))), 'A tree maps names to file objects or more directory trees. Reading this map is different from downloading all file contents.'),
      frame('Follow only the required directory', flow(card('Selected directory', 'checkout/', files('pay.go → P7'), 'active'), card('Unrequested directories', 'catalog/ and docs/', p('Their contents are not fetched.'))), 'The job asks for the payment directory’s tree. It can skip unrelated directories.'),
      frame('Materialize just the requested file', flow(card('Object P7', 'fee = 7', p('Fetch if missing locally.')), card('Job’s working files', 'checkout/pay.go', p('fee = 7<br>Ready for the test.'), 'active')), 'Materialize means putting file contents on disk. Selecting only part of a repository is called a sparse checkout.')
    ],
    takeaway: 'A repository can be huge while one job’s required slice stays small.',
    depthTitle: 'Sparse versus virtualized checkout',
    depth: '<p>Sparse selection limits which paths are included. Virtualization can delay materializing selected files until a program reads them. These are related but distinct ways to reduce work.</p><p>Real build systems must include dependencies, configuration and tools too. “Only pay.go” is an explicit simplification for this imaginary test, not a dependency-discovery algorithm.</p>',
    note: 'Scion requests missing trees and blobs; its protocol supports sparse and on-demand file access.', url: source
  },
  {
    id: 'cache', name: 'Follow a cache lookup', title: 'Ask the nearest copy first.',
    intro: 'P7 is immutable, so nearby copies can answer requests for it. A node cache is shared by jobs on one machine. A regional cache is shared across machines in one region.',
    frames: [],
    takeaway: 'A hit ends the search. Reusing nearby copies reduces work farther upstream.',
    depthTitle: 'What does this model leave out?',
    depth: '<p>The teaching model groups the source service and durable storage into one “source” box. It shows one object and a simple fill path. Real systems have eviction, concurrent requests, permissions and more storage layers.</p><p>There is no latency scale or throughput benchmark here. The point is which tier is contacted, not how many milliseconds an operation takes.</p>',
    note: 'Scion uses node daemons, regional caches and authoritative servers.', url: source
  },
  {
    id: 'main', name: 'Separate content from main', title: 'Two changes. One shared pointer.',
    intro: '“main” is a name pointing at the chosen version. Two writers can prepare different versions, but both must not silently overwrite that shared pointer.',
    frames: [
      frame('Both writers start from A', flow(card('Writer 1', 'Prepare B from A', p('Expected main: A')), card('Shared pointer', 'main → A', p('One mutable value.'), 'active'), card('Writer 2', 'Prepare D from A', p('Expected main: A'))), 'B changes the payment file. D changes the help page. Creating those records does not, by itself, decide which version main names.'),
      frame('Writer 1 updates main', flow(card('Writer 1', 'If main is A, set B', p('Comparison succeeds.'), 'active'), card('Shared pointer', 'main → B', p('Now includes the payment change.')), card('Writer 2', 'Still expects A', p('Its expectation is out of date.'))), 'Compare-and-swap means “replace this value only if it is still the value I expected.” The comparison and update must be atomic: one indivisible operation.'),
      frame('Writer 2 cannot overwrite B blindly', flow(card('Writer 2', 'If main is A, set D', p('Comparison fails.'), 'blocked'), card('Shared pointer', 'main → B', p('B is preserved.'), 'active'), card('Next decision', 'Reconcile, then retry', p('D still exists as a saved change.'))), 'A rejected pointer update does not delete D. The writer needs a new plan that accounts for B; automatically retrying the same stale request cannot solve that.')
    ],
    takeaway: 'Immutable objects simplify sharing. Mutable names still need coordination.',
    depthTitle: 'Does “lock-free commits” mean no coordination anywhere?',
    depth: '<p>No. Storing a new immutable record and choosing the shared main version are different operations. This toy race isolates the second operation; it is not an implementation of a merge queue.</p><p>Do not infer that the underlying database is lock-free. Transaction concurrency control and application-level commit creation are separate subjects. <a href="https://docs.cloud.google.com/spanner/docs/concurrency-control">Spanner concurrency control ↗</a></p>',
    note: 'Scion separates changeset creation from ref updates; refs use compare-and-swap on a Spanner row.', url: source
  },
  {
    id: 'failure', scope: 'Illustrative no-bypass policy, not a documented Scion error response. Specific timeouts, retries and regional recovery are not specified here.', name: 'Keep an outage contained', title: 'A shortcut can spread a failure.',
    intro: 'Here, all nearby caches start empty again. A cache miss means a reachable cache lacks an object. A cache outage means the cache cannot answer. Those are different situations.',
    frames: [
      frame('Normal request path', flow(card('Node cache', 'Ask for P7', p('No local copy.')), card('Regional cache', 'Forward a miss', p('Healthy, but missing P7.')), card('Source', 'Serve P7', p('Request reaches source.'), 'active')), 'A healthy cache can forward a miss through the intended path.'),
      frame('The regional cache is unavailable', flow(card('Node cache', 'Needs P7', p('No local copy.')), card('Regional cache', 'Unavailable', p('Request cannot continue.'), 'blocked'), card('Source', 'Not contacted', p('No direct bypass.'))), 'In this teaching model, the request fails at the regional tier. Keeping the source protected means this uncached request loses availability.'),
      frame('Why not send everyone around it?', flow(card('Many nodes', 'Direct bypass?', p('Every miss can reach source.')), card('Source', 'Sudden surge', p('Could exceed its capacity.'), 'blocked')), 'The regional cache normally absorbs repeated requests. Bypassing it removes that protection. A local hit can still work because it needs no regional request.')
    ],
    takeaway: 'Protecting the wider system may mean refusing some requests during an outage.',
    depthTitle: 'What can we conclude about real outage behavior?',
    depth: '<p>The blocked request shown here is a teaching choice, not a documented Scion error response. The article does not spell out timeout values, retries or regional recovery.</p><p>Useful design questions: which requests can use local copies, where should retries stop, and how much traffic can the next tier safely accept? These need an explicit policy and measurements.</p>',
    note: 'Scion enforces cache tiering to prevent regional failures from overwhelming upstream servers.', url: source
  },
  {
    id: 'recap', presentation: 'comparison', name: 'Put the pieces together', title: 'Trace one change into one test.',
    intro: 'You now have the pieces. Follow the payment edit from a new object to a file on a test job’s disk.',
    frames: [
      frame('1. Store the change', flow(card('New contents', 'P7: fee = 7', p('P5 stays unchanged.')), card('Change B', 'Parent A; pay.go → P7', p('Unchanged files remain available.'), 'active')), 'The edit adds new content and a change record. This alone does not move main.'),
      frame('2. Resolve the needed path', flow(card('Test request', 'pay.go at B', p('A specific version.')), card('File view', 'pay.go → P7', p('Use a suitable derived view.'), 'active')), 'The test names B directly. It does not have to ask what main points to now.'),
      frame('3. Find a copy and run', flow(card('Lookup', 'Node → region → source', p('Stop at the first hit.')), card('Working file', 'checkout/pay.go', p('fee = 7<br>Run the test.'), 'active')), 'Fetch only the required contents. Preserve object identity. Reuse nearby copies. Treat mutable names and failures explicitly.')
    ],
    takeaway: 'The reusable skill: connect workload, data layout, request path and failure behavior.',
    depthTitle: 'Source, scope and further reading',
    depth: '<p>This independent guide uses an invented shop repository to teach selected architecture ideas. It is not a complete Scion specification or a replacement for its engineering documentation.</p><p>Not covered: authentication design, durable-write acknowledgement, garbage collection, merge correctness or derived-index recovery. Do not infer those guarantees from the diagrams.</p><p>Read the article’s “What we learned” section for the team’s development and operational experience. Performance and productivity claims there are self-reported. This guide does not simulate those measurements.</p><p>Foundations: <a href="https://git-scm.com/book/en/v2/Git-Internals-Git-Objects">Git objects</a> · <a href="https://docs.cloud.google.com/spanner/docs/concurrency-control">Spanner concurrency control</a>.</p>',
    note: 'Inspired by Anthropic’s “Redesigning source control at Anthropic,” published 13 October 2026.', url: source
  }
];

export function cacheFrames(copies, regionalDown, result) {
  const names = ['Node cache', 'Regional cache', 'Source + storage'];
  const lookup = result.visited.map((tier, n) => frame(
    `${n + 1}. Ask the ${names[tier].toLowerCase()}`,
    flow(...names.map((name, i) => card(name, i === tier && regionalDown && i === 1 ? 'Unavailable' : copies[i] ? 'P7 stored here' : 'No P7 here', p(i === tier ? (regionalDown && i === 1 ? 'Blocked — no bypass' : copies[i] ? 'HIT — serve the copy' : 'MISS — continue outward') : result.visited.slice(0, n).includes(i) ? 'Already checked.' : 'Not contacted yet.'), i === tier ? (regionalDown && i === 1 ? 'blocked' : 'active') : ''))),
    regionalDown && tier === 1 ? 'The regional cache cannot answer. This model stops here to avoid flooding the source.' : copies[tier] ? `A hit at the ${names[tier].toLowerCase()}. No farther tier needs to be contacted.` : 'This tier is reachable but has no copy. Try the next tier in the path.'
  ));
  if (!result.blocked) lookup.push(frame('Return P7 and retain reusable copies', flow(...names.map((name, i) => card(name, result.after[i] ? 'P7 stored here' : 'No P7 here', p(result.visited.includes(i) ? 'On this request path.' : 'Not contacted.'), result.visited.includes(i) ? 'active' : ''))), 'The job receives fee = 7. In this model, visited caches retain the returned object. Choose “Repeat request” below to use this resulting state.'));
  return lookup;
}
