import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignPartitions,
  articleOutline,
  articleFacts,
  classifyDelivery,
  consumerReadRoute,
  designScope,
  nextOffset,
  estimateCapacity,
  electLeaderAfterFailure,
  replicationGuarantee,
  rebalanceTimeline,
  partitionForKey,
  recommendedAction,
  autoCommitOutcome,
  producerRetryOutcome,
} from '../labs/kafka/app.js';

test('maps the source article in its original learning order', () => {
  assert.deepEqual(articleOutline().map((section) => section.id), [
    'scope', 'goals', 'capacity', 'architecture', 'storage',
    'partitions', 'groups', 'replication', 'api-data', 'bottlenecks',
  ]);
  assert.equal(articleOutline()[0].number, '01');
  assert.equal(articleOutline()[9].number, '10');
});

test('keeps the article’s essential technical claims', () => {
  const facts = articleFacts();
  assert.equal(facts.defaultDelivery, 'at-least-once');
  assert.equal(facts.durableWrite, 'acks=all + min.insync.replicas=2');
  assert.equal(facts.offsetStore, '__consumer_offsets');
  assert.match(facts.exactlyOnceBoundary, /inside Kafka/i);
});

test('keeps one order key in one deterministic partition', () => {
  assert.equal(partitionForKey('order-123', 6), partitionForKey('order-123', 6));
  assert.ok(partitionForKey('order-123', 6) >= 0);
  assert.ok(partitionForKey('order-123', 6) < 6);
});

test('shows duplicate risk when a worker crashes before offset commit', () => {
  assert.equal(
    classifyDelivery({ providerAccepted: true, offsetCommitted: false }),
    'duplicate-risk',
  );
});

test('recommends delayed retry for a provider rate limit', () => {
  assert.match(recommendedAction('429'), /backoff/i);
});

test('estimates retained replicated storage and fan-out read traffic', () => {
  const estimate = estimateCapacity({ messagesPerSecond: 2000, messageBytes: 1000, fanout: 3, retentionDays: 7, replicationFactor: 3 });
  assert.equal(estimate.writeMBps, 2);
  assert.equal(estimate.readMBps, 6);
  assert.equal(estimate.replicatedStorageTB, 3.6288);
  assert.equal(estimate.rawStorageTBPerDay, 0.1728);
  assert.equal(estimate.combinedGBps, 0.008);
});

test('states queue requirements and important boundaries', () => {
  const scope = designScope();
  assert.ok(scope.canDo.includes('replay retained records'));
  assert.ok(scope.guarantees.includes('order within one partition'));
  assert.ok(scope.qualityTargets.includes('broker failure recovery'));
  assert.ok(scope.outOfScope.includes('exactly-once external side effects'));
});

test('assigns each partition to one consumer in a consumer group', () => {
  assert.deepEqual(assignPartitions(5, 2), [[0, 2, 4], [1, 3]]);
});

test('shows durability difference between acks settings', () => {
  assert.match(replicationGuarantee({ acks: '1', minISR: 2 }), /leader dies/i);
  assert.match(replicationGuarantee({ acks: 'all', minISR: 2 }), /two in-sync replicas/i);
});

test('elects a caught-up replica after a leader failure', () => {
  assert.match(electLeaderAfterFailure({ isr: ['A', 'B', 'C'] }), /B.*new leader/i);
  assert.match(electLeaderAfterFailure({ isr: ['A'], uncleanElection: false }), /unavailable/i);
  assert.match(electLeaderAfterFailure({ isr: ['A'], uncleanElection: true }), /data loss/i);
});

test('shows the safe rebalance sequence after a consumer leaves', () => {
  assert.deepEqual(rebalanceTimeline('consumer 2'), [
    'consumer 2 misses heartbeats',
    'coordinator starts a rebalance',
    'remaining consumers receive new assignments',
    'each consumer resumes from its committed offsets',
  ]);
});

test('uses the leader for ordinary consumer reads', () => {
  assert.match(consumerReadRoute({ leader: 'A' }), /leader A/i);
  assert.match(
    consumerReadRoute({ leader: 'A', followerReadsEnabled: true, preferredFollower: 'B' }),
    /follower B/i,
  );
});

test('commits the next offset after handling a record', () => {
  assert.equal(nextOffset(42), 43);
});

test('shows why auto commit can skip work after a crash', () => {
  const outcome = autoCommitOutcome({ committedNext: 40, polledThrough: 44, processedThrough: 41 });
  assert.equal(outcome.autoCommittedNext, 45);
  assert.deepEqual(outcome.skippedAfterCrash, [42, 43, 44]);
  assert.equal(outcome.manualCommittedNext, 42);
});

test('uses producer identity and sequence numbers to suppress a lost-ack retry', () => {
  assert.deepEqual(producerRetryOutcome({ idempotent: false }), { recordsInLog: 2, result: 'duplicate' });
  assert.deepEqual(producerRetryOutcome({ idempotent: true }), { recordsInLog: 1, result: 'duplicate-suppressed' });
});

test('capacity rejects nonpositive, missing or nonfinite inputs and arithmetic overflow',()=>{
 const good={messagesPerSecond:1,messageBytes:1,fanout:1,retentionDays:1,replicationFactor:1};
 for(const field of Object.keys(good))for(const value of [0,-1,NaN,Infinity,undefined])assert.throws(()=>estimateCapacity({...good,[field]:value}),/positive|finite|valid/i);
 assert.throws(()=>estimateCapacity({...good,messagesPerSecond:1e308,messageBytes:1e308}),/finite|range/i);
});
