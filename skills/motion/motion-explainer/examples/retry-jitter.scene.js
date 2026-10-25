// Idea example: thundering herd vs exponential backoff with jitter.
// Toy model, simulated below: 8 clients, server capacity 3 requests per tick,
// a tick with more than 3 arrivals overloads the server and every request in it fails.
const N = 8, RETRIES = 4, CAP = 3, T0 = 0.5, SEED = 36;
const X = t => 230 + t * 55;            // time axis: 0..16 ticks
const ROW = i => 150 + i * 56;          // one lane per client
const BASE = 815, UNIT = 15;            // load chart: px per request
const clients = [...Array(N).keys()];
const dot = (i, k) => `d${i}_${k}`;
const attempt = k => clients.map(i => dot(i, k));
const bars = [...Array(16).keys()].map(b => `b${b}`);

// Deterministic PRNG so every build shows the same run.
function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Attempt times per client: index 0 is the call that failed in the blip.
const fixed = clients.map(() => [0, 1, 2, 3, 4].map(k => T0 + k));
const backoff = clients.map(() => [0, 1, 2, 3, 4].map(k => T0 + 2 ** k - 1));
const rand = rng(SEED);
const jitter = clients.map(() => {
  const t = [T0];
  for (let k = 1; k <= RETRIES; k++) {
    let x;
    // Full jitter: sleep U(0, base * 2^(k-1)). Resample tiny gaps so dots don't overlap.
    do x = t[k - 1] + rand() * 2 ** (k - 1);
    while (x - t[k - 1] < 0.4 || (Math.floor(x) >= 1 && Math.floor(x) === Math.floor(t[k - 1])));
    t.push(x);
  }
  return t;
});

// Run the toy server tick by tick: tick 0 is the blip, later ticks fail if over capacity.
function judge(times) {
  const next = clients.map(() => 0), win = clients.map(() => -1), gone = clients.map(() => false), cnt = [];
  for (let b = 0; b < 16; b++) {
    const arr = [];
    for (const i of clients) {
      while (!gone[i] && win[i] < 0 && Math.floor(times[i][next[i]]) === b) {
        arr.push(i);
        if (b > 0) break;
        if (++next[i] > RETRIES) gone[i] = true;
      }
    }
    cnt[b] = arr.length;
    if (b === 0) continue;
    for (const i of arr) {
      if (arr.length <= CAP) win[i] = next[i];
      else if (++next[i] > RETRIES) gone[i] = true;
    }
  }
  return { win, cnt };
}
const counts = times => {
  const c = bars.map(() => 0);
  times.forEach(r => r.forEach(t => { if (t < 16) c[Math.floor(t)]++; }));
  return c;
};
const J = judge(jitter);

// One `set` per bar: grow it from the baseline, and hide empty ones.
const bar = (b, n, extra) => ({ set: `b${b}`, h: n * UNIT, y: BASE - n * UNIT / 2, alpha: n ? 1 : 0, with: true, ...extra });
const barTo = (c, tone) => c.map((n, b) => bar(b, n, tone ? { tone: typeof tone === 'function' ? tone(n, b) : tone } : {}));
const moveTo = times => ({ move: Object.fromEntries(clients.flatMap(i => [1, 2, 3, 4].map(k => [dot(i, k), { x: X(times[i][k]) }]))) });

const code = (id, title, sleep) => ({
  id, type: 'code', x: 1355, y: 400, w: 380, size: 17, title,
  lines: ['delay = base', 'repeat up to max_retries:', '  if call() succeeds: return', sleep, '  delay = min(cap, delay * 2)', 'give up, report the error'],
});

const elements = [
  ...clients.map(i => ({ id: `c${i}`, type: 'box', shape: 'pill', x: 120, y: ROW(i), w: 112, h: 40, label: `client ${i + 1}`, size: 18 })),
  { id: 'server', type: 'box', x: 1355, y: 346, w: 300, h: 130, label: 'Server', sub: 'healthy', size: 28, tone: 'ok' },
  // toOffset spreads the arrowheads along the server's left edge instead of piling them up.
  ...clients.map(i => ({ id: `a${i}`, type: 'arrow', from: `c${i}`, to: 'server', toOffset: [-158, -42 + i * 12], width: 1.5 })),

  { id: 'lanes', type: 'zone', x: 660, y: 340, w: 940, h: 480, label: 'Retry attempts per client' },
  ...[0, 2, 4, 6, 8, 10, 12, 14, 16].map(t => ({ id: `t${t}`, type: 'text', x: X(t), y: 600, text: String(t), size: 18, tone: 'dim' })),
  { id: 'tlabel', type: 'text', x: 120, y: 600, text: 'time (ticks) →', size: 18, tone: 'dim' },
  ...clients.flatMap(i => [0, 1, 2, 3, 4].map(k => ({
    id: dot(i, k), type: 'circle', x: X(fixed[i][k]), y: ROW(i), r: 10, tone: k ? 'accent' : 'bad',
  }))),

  { id: 'loadz', type: 'zone', x: 660, y: 730, w: 940, h: 200, label: 'Requests reaching the server, per tick' },
  ...bars.map((id, b) => ({ id, type: 'box', x: X(b + 0.5), y: BASE, w: 34, h: 0, radius: 3, alpha: 0, tone: 'bad' })),
  { id: 'capline', type: 'arrow', from: [X(0) - 10, BASE - CAP * UNIT], to: [X(16) + 10, BASE - CAP * UNIT], head: false, dashed: true, width: 2, tone: 'bad' },
  { id: 'caplabel', type: 'text', x: 1142, y: BASE - CAP * UNIT, text: '← capacity: 3 per tick', size: 18, tone: 'bad', align: 'start' },
  { id: 'toy', type: 'text', x: 1142, y: 812, text: 'Toy model: over capacity, the whole tick fails.', size: 17, tone: 'dim', align: 'start', maxw: 390 },

  code('code1', 'retry with backoff', '  sleep(delay)'),
  code('code2', 'retry with backoff + jitter', '  sleep(random(0, delay))'),
  { id: 'herd', type: 'note', x: 1355, y: 640, w: 380, tone: 'bad', title: 'The thundering herd',
    text: 'A recovering server gets hit by every client at once, fails again, and sets up the next synchronized wave. Retrying sooner makes it worse.' },
  { id: 'gaveup', type: 'text', x: 860, y: 346, text: 'Every wave fails: all 8 give up', size: 22, tone: 'bad' },
  { id: 'through', type: 'text', x: 860, y: 346, text: `All 8 through by tick ${Math.ceil(Math.max(...clients.map(i => jitter[i][J.win[i]])))}`, size: 22, tone: 'ok' },
  { id: 'both', type: 'note', x: 1355, y: 640, w: 380, tone: 'ok', title: 'You need both',
    text: 'Backoff lowers the retry rate over time. Jitter breaks the synchronization. Cap the delay and the attempts.' },
];

const arrows = clients.map(i => `a${i}`);
const ticks = [0, 2, 4, 6, 8, 10, 12, 14, 16].map(t => `t${t}`);
const normal = [0.0, 0.5, 0.25, 1.1, 0.8, 1.5, 0.35, 1.3];   // unsynchronized: spread in time

const steps = [
  { title: 'Many clients, one server',
    say: 'Eight clients call the same server. On a normal day their calls are spread out in time, so the server only sees a few at once and keeps up.',
    do: [{ show: clients.map(i => `c${i}`), stagger: .06 }, { show: 'server' }, { show: arrows, fx: 'draw', stagger: .04 },
         ...clients.map(i => ({ flow: `a${i}`, at: 2.6 + normal[i], tone: 'ok' }))] },

  { title: 'A blip fails everyone at once',
    say: 'The server hiccups for one tick. Every call in flight fails **at the same moment**, so all eight clients now share one failure time.',
    do: [{ set: 'server', tone: 'bad', sub: 'blip: failing every call' }, { pulse: 'server', tone: 'bad', with: true },
         ...clients.map(i => ({ flow: `a${i}`, reverse: true, tone: 'bad', with: true })),
         { hide: arrows }, { move: 'server', y: 185, with: true }, { show: ['lanes', 'tlabel', ...ticks] }, { show: attempt(0), stagger: .05 },
         { show: ['loadz', ...bars], dur: .3 }, bar(0, N)] },

  { title: 'Naive retry: wait 1 tick, try again',
    say: 'Each client waits a fixed delay and retries. They failed together, so they **retry together**: every wave is all eight clients in the same tick.',
    do: [{ set: 'server', sub: 'overloaded by retries' },
         ...[1, 2, 3, 4].flatMap(k => [{ show: attempt(k), stagger: .03, dur: .4 }, bar(k, N), { pulse: 'server', tone: 'bad', with: true }])] },

  { title: 'The thundering herd',
    say: 'Here is what the server sees: 8 requests per tick against a capacity of 3. Each wave knocks it over again, and the failures feed the next wave.',
    do: [{ show: 'capline', dur: .8 }, { show: ['caplabel', 'toy'] }, { show: 'herd' }, { pulse: 'server', tone: 'bad' }] },

  { title: 'Exponential backoff: double the wait',
    say: 'Backoff doubles the wait after each failure: 1, 2, 4, then 8 ticks. The retry rate drops fast, and the server gets longer quiet gaps in between.',
    do: [{ hide: 'herd' }, { show: 'code1', with: true }, { line: 'code1', n: 4 },
         moveTo(backoff), ...barTo(counts(backoff)),
         { set: 'server', sub: 'overloaded on every wave' }] },

  { title: 'Backoff alone keeps them in lockstep',
    say: 'But every client computed the same delays from the same failure time. The waves are rarer, yet each one is still **8 requests in one tick**. Every wave fails, and after 4 retries all 8 give up.',
    do: [{ focus: [...attempt(2), 'b3', 'capline', 'caplabel', 'server', 'loadz', 'lanes', 'gaveup'] }, { show: 'gaveup', with: true }, { pulse: 'b3', tone: 'bad' }, { pulse: 'server', tone: 'bad', with: true }] },

  { title: 'Add jitter: randomize each wait',
    say: 'Jitter makes each client sleep a **random** time between 0 and its backoff delay. The windows still double, but the clients drift apart, so retries spread out instead of landing in one tick.',
    do: [{ unfocus: true }, { hide: 'gaveup', with: true }, { hide: 'code1', dur: .3 }, { show: 'code2', with: true }, { line: 'code2', n: 4 },
         { ...moveTo(jitter), dur: 1.4 },
         ...barTo(counts(jitter), 'plain'), { set: 'server', tone: 'warn', sub: 'recovering' }] },

  { title: 'The herd dissolves',
    say: 'The first retries still collide, but each window is twice as wide, so the crowd thins every round. Soon each tick is under capacity, and each client gets through and stops retrying.',
    do: [...clients.flatMap(i => [1, 2, 3, 4].map(k => (k < J.win[i] ? { set: dot(i, k), tone: 'bad' }
           : k === J.win[i] ? { set: dot(i, k), tone: 'ok' } : { hide: dot(i, k) })).map((a, j) => (j || i ? { ...a, with: true } : a))),
         ...barTo(J.cnt, (n, b) => (b === 0 || n > CAP ? 'bad' : 'ok')),
         { set: 'server', tone: 'ok', sub: 'recovered' }, { pulse: 'server', tone: 'ok', with: true }, { show: 'through' }] },

  { title: 'Backoff + jitter + limits',
    say: 'Backoff spreads retries over **time**; jitter spreads them across **clients**. Cap the delay and the number of retries, so a long outage ends in a clear error, not endless load.',
    do: [{ show: 'both' }, { line: 'code2', n: 5 }] },
];

Motion.scene({
  title: 'Why retries need exponential backoff with jitter',
  subtitle: 'Synchronized retries keep knocking a recovering server over; backoff spreads them in **time**, jitter spreads them across **clients**',
  eyebrow: 'Distributed systems',
  elements,
  steps,
});
