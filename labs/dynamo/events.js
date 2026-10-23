import { orderedEvents } from './timeline.js?v=dynamo20261023-final';
// Deterministic teaching schedules, not measured production timings.
export function writeTrace({ replicas, delays, required, deadline, ackDelay = 0 }) {
  if (new Set(replicas).size !== replicas.length || required < 1 || required > replicas.length) {
    throw new RangeError('Write threshold requires distinct physical replicas');
  }
  const events = [{ time: 0, kind: 'send', text: `Send version to ${replicas.join(', ')}.` }];
  const delivered = replicas.map((node, index) => ({ node, time: delays[index] }))
    .filter(event => Number.isFinite(event.time) && event.time >= 0)
    .sort((a, b) => a.time - b.time || a.node.localeCompare(b.node));
  let count = 0;
  let responded = false;
  const acknowledgements=[];
  for (const event of delivered) {
    events.push({ ...event, kind: 'persist', text: `${event.node} persists version. Acknowledgement is a separate event.` });
    acknowledgements.push({...event,time:event.time+(event.node===replicas[0]?0:ackDelay),kind:'ack',text:`${event.node} acknowledgement reaches coordinator.`});
  }
  for(const event of orderedEvents(acknowledgements)) {
    events.push({...event,id:events.length});count++;
    if (!responded && count >= required && event.time <= deadline) {
      events.push({ time: event.time, kind: 'response', text: `${required} distinct copies acknowledged; caller receives success.` });
      responded = true;
    }
  }
  if (!responded) events.push({ time: deadline, kind: 'timeout', text: 'Deadline reached without enough replies. Caller receives timeout; some writes may still exist.' });
  return orderedEvents(events);
}

export function sloppyPartition() {
  const writeSet = ['A', 'D'];
  const readSet = ['B', 'C'];
  return { n: 3, r: 2, w: 2, writeSet, readSet,
    intersection: readSet.filter(node => writeSet.includes(node)) };
}
