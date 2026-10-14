// Deliberately small teaching models, not Scion's protocol implementation.
export function fetchObject(copies, regionalDown) {
  const visited = [];
  const after = [...copies];
  for (let i = 0; i < copies.length; i++) {
    visited.push(i);
    if (i === 1 && regionalDown) return { visited, after, blocked: true };
    if (copies[i]) {
      for (let j = 0; j <= i; j++) after[j] = true;
      return { visited, after, blocked: false };
    }
  }
  return { visited, after, blocked: true };
}

export function moveMain(current, expected, next) {
  return current === expected ? { main: next, accepted: true } : { main: current, accepted: false };
}

export function safePosition(value, count) {
  return Number.isInteger(value) && value >= 0 && value < count ? value : 0;
}
