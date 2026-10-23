// Original self-paced teaching explanations. Source references point to the historical 2007 paper.
const beat = (id, level, frame, title, text) => ({ id, level, frame, title, text });
export const clockHistory = [
 {id:'D1',clock:{Sx:1}}, {id:'D2',clock:{Sx:2}},
 {id:'D3',clock:{Sx:2,Sy:1}}, {id:'D4',clock:{Sx:2,Sz:1}},
 {id:'D5',clock:{Sx:3,Sy:1,Sz:1}}
];
export const chapters = [
 {title:'A cart becomes a write',part:'01 / Make copies',source:'§§1, 4.1, 4.4',kind:'network',beats:[
  beat('cart',1,0,'Start with one cart','A customer has a shopping cart. Its contents are stored together as one object.'),
  beat('edit',1,1,'Add a book','The customer adds a book. The application prepares a new cart value, rather than asking storage to interpret a shopping action.'),
  beat('send',1,2,'Send the new value','The application sends the cart and its earlier context. Context records which versions this change includes.'),
  beat('coordinate',1,3,'One request, one coordinator','A storage host coordinates this request. It will organize copies and collect replies.'),
  beat('coordinator',2,3,'A role, not an elected leader','Coordinator means the node handling this operation. It is not a permanent leader for every request.'),
  beat('key',3,3,'One key, one object','Our invented key is cart:42. The book and pen used in this walkthrough are teaching examples, not a production trace.'),
  beat('scope',4,3,'Historical scope','This walkthrough describes the Dynamo system in the two thousand seven paper. It does not describe the current DynamoDB service.')
 ]},
 {title:'Copies are not replies',part:'01 / Make copies',source:'§§4.3–4.5',kind:'network',beats:[
  beat('local',1,0,'The first copy is stored','Host A stores the new cart locally. Other hosts still need their copies.'),
  beat('copy',1,1,'Another host stores it','A sends the value to B. Storing bytes is one event; a reply reaching the coordinator is another.'),
  beat('reply',1,2,'A second reply arrives','B acknowledges its write. The coordinator now has confirmation from two distinct hosts.'),
  beat('success',1,3,'Success before every copy','With two acknowledgements required, the customer can receive success. The third copy can still be pending.'),
  beat('threshold',2,3,'Count distinct hosts','Replica count is the desired number of copies. The write threshold counts participating hosts needed for this request to succeed.'),
  beat('numbers',3,3,'Three targets, two replies','Our synthetic schedule stores at A after one millisecond and at B after three. With two replies required, success is at three milliseconds; C is scheduled at eight.'),
  beat('durable',4,3,'Success has assumptions','This example uses durable writes and immediate acknowledgements after storage. It is not a claim that every accepted update survives every later failure.')
 ]},
 {title:'A missing reply',part:'02 / Work through failure',source:'§§4.5–4.6',kind:'network',beats:[
  beat('missing',1,0,'One host is unreachable','Now C cannot be reached. A missing reply tells us about this request, not everything that might be on that disk.'),
  beat('two',1,1,'Two reachable copies can suffice','A and B can still acknowledge the new value. A request requiring two replies can complete.'),
  beat('three',1,2,'Waiting for three changes the outcome','Require three replies from these same targets instead. The unreachable host prevents that threshold being met before the deadline.'),
  beat('timeout',1,3,'Timeout does not mean no write','The customer sees a timeout in that second case. Copies already written at A and B have not magically disappeared.'),
  beat('deadline',2,3,'A threshold and a deadline','Completion depends on enough replies arriving in time. A slow reply and an unreachable host can both prevent timely completion.'),
  beat('deadline-numbers',3,3,'An explicit teaching deadline','Explore uses a synthetic six millisecond deadline. A and B can reply before it, while the scheduled eight millisecond C write would be late even without failure.'),
  beat('uncertain',4,3,'An uncertain result','Do not infer from a timeout that retrying is the first attempt to affect state. This walkthrough makes no retry or exactly-once guarantee.')
 ]},
 {title:'A temporary home',part:'02 / Work through failure',source:'§4.6',kind:'network',beats:[
  beat('fallback-start',1,0,'Copies need reachable destinations','Keep C unreachable. For another write, a reachable candidate farther down the preference list can hold a temporary copy.'),
  beat('fallback-select',1,1,'Use a fallback host','Host D receives the value. The copy carries a hint naming C as its intended home.'),
  beat('fallback-store',1,2,'Keep the destination with the data','D stores that hinted copy separately. The hint is a promise to try delivery later, not a permanent membership change.'),
  beat('fallback-wait',1,3,'Continue now, deliver later','The request still needs enough replies to succeed. C does not need to recover before a reachable fallback can participate.'),
  beat('sloppy',2,3,'The participants can change','This is sloppy placement. Different coordinators can reach different sets of hosts during a partition.'),
  beat('overlap',3,3,'Numbers alone do not prove overlap','Two write replies and two read replies need not overlap when the participant sets change. For example, A and D can acknowledge a write while B and C answer a read.'),
  beat('fallback-risk',4,3,'A hint is not a backup from nothing','If a fallback loses the only surviving copy of an update, a hint cannot recreate that value. Repair needs surviving information.')
 ]},
 {title:'Two honest histories',part:'02 / Work through failure',source:'§4.4, Figure 3',kind:'history',beats:[
  beat('base',1,0,'Start from the same cart','Two customers begin from the same saved cart containing a book. Neither has yet seen the other customer’s edit.'),
  beat('add-branch',1,1,'One customer adds a pen','The first customer adds a pen. Their new cart contains the book and the pen.'),
  beat('remove-branch',1,2,'Another removes the book','The other customer removes the book from the shared earlier cart. Their new cart is empty.'),
  beat('siblings',1,3,'Neither edit includes the other','Both changes are meaningful, but neither contains the other’s history. Storage keeps these concurrent versions instead of silently choosing one.'),
  beat('siblings-role',2,3,'Siblings are versions, not replicas','Replicas are physical copies. Siblings are different versions of the same object; one host can hold more than one sibling.'),
  beat('history-example',3,3,'Paper clocks, invented cart contents','We attach these cart values to D two, D three and D four in the paper’s version graph. The clocks follow Figure three; the cart contents are invented.'),
  beat('no-clock-winner',4,3,'Arrival order is not causality','The later arriving request need not include the earlier edit. A physical timestamp alone does not establish which history contains which.')
 ]},
 {title:'History, not wall time',part:'03 / Bring histories together',source:'§4.4, Figure 3',kind:'history',beats:[
  beat('causal-base',1,0,'A version carries its past','Each version carries information about updates it has incorporated. Think of it as a compact record of history.'),
  beat('ancestor',1,1,'Following a known version','The pen edit builds on the earlier cart. Its history includes that earlier version, so storage can recognize an ancestor.'),
  beat('concurrent',1,2,'Two branches share an ancestor','The removal edit also builds on the earlier cart. It has not seen the pen edit, and the pen edit has not seen it.'),
  beat('compare',1,3,'Different histories remain visible','Storage can detect that neither branch includes the other. Detecting this conflict does not tell the application how to merge the cart.'),
  beat('vector',2,3,'Counters, not seconds','A vector clock maps coordinating nodes to update counters. These counters represent causal history, not elapsed time.'),
  beat('components',3,3,'Compare every component','D three has counters two, one, zero. D four has two, zero, one. Each is larger in one component, so neither descends from the other.'),
  beat('truncation',4,3,'History metadata has limits','The paper prunes old clock entries when they grow too large. This can lose ancestry precision; its safety was not thoroughly investigated.')
 ]},
 {title:'Meaning belongs to the app',part:'03 / Bring histories together',source:'§4.4, Figure 3',kind:'history',beats:[
  beat('return-siblings',1,0,'Return both branches','A read can return both concurrent cart versions with their context. The application must decide what the changes mean.'),
  beat('union',1,1,'A simple union has a cost','Combine both snapshots by keeping every item seen in either. The book comes back, even though one customer removed it.'),
  beat('policy',1,2,'Choose an explicit policy','If the application has the common base and both edit intentions, it could apply both known edits. In this teaching policy, only the pen remains.'),
  beat('reconcile',1,3,'Write the result with both histories','The application writes its chosen cart with context covering both branches. The new version can then supersede both siblings.'),
  beat('opaque',2,3,'Clocks cannot choose cart policy','Dynamo treats the object as bytes. Keeping additions, honoring removals and enforcing business rules are application decisions.'),
  beat('join',3,3,'Join history, then record the update','For D five, combine the largest counters from both branches and increment S x for the new write. The result is three, one, one.'),
  beat('edit-assumption',4,3,'The edit-policy assumption matters','Two snapshots alone do not necessarily reveal what each user intended. Our edit-aware option explicitly supplies the common base and intentions; vector clocks do not supply them.')
 ]},
 {title:'Recovery has three jobs',part:'03 / Bring histories together',source:'§§4.6–4.7, §5',kind:'network',beats:[
  beat('recovery',1,0,'The old home becomes reachable','C returns. D still holds a copy of the reconciled cart with a hint naming C.'),
  beat('handoff',1,1,'Deliver the hinted copy','D transfers that copy to C. After a successful transfer, D can remove its temporary hinted copy.'),
  beat('read-repair',1,2,'A read can expose a stale replica','A later read can discover that another replica still holds an ancestor. Read repair can update that stale copy.'),
  beat('anti-entropy',1,3,'Background repair handles other gaps','Anti-entropy compares shared key ranges in the background. Handoff, read repair and anti-entropy have different triggers; they are not one operation.'),
  beat('merkle',2,3,'Find where data differs','Merkle trees summarize ranges with hashes. Matching branches need no further comparison; differing branches lead toward keys that need repair.'),
  beat('repair-values',3,3,'Hashes locate, values repair','A differing hash does not contain the missing cart. Actual versions still have to be transferred and reconciled when their histories conflict.'),
  beat('boundary',4,3,'Availability is a trade-off','The design can accept work through some failures, then reconcile and repair. It cannot promise completion under every failure, or recover information that has no surviving copy.')
 ]}
];

export const motionGlossary = {
 N:'N — desired number of copies on distinct physical hosts.',
 R:'R — minimum participating hosts required for a successful read.',
 W:'W — minimum participating hosts required for a successful write.',
 Sx:'Sx — a coordinating node. Its clock component counts updates via Sx, not seconds.',
 Sy:'Sy — a coordinating node. Its clock component counts updates via Sy, not seconds.',
 Sz:'Sz — a coordinating node. Its clock component counts updates via Sz, not seconds.'
};
