// Algorithm example: the steps come from a real run of the loop below,
// so the animation cannot drift from what binary search actually does.
const a = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
const target = 23;
const X = i => 251 + i * 122;
const ROW = 320;

const elements = [
  { id: 'title', type: 'text', x: 800, y: 100, text: `Binary search: where is ${target}?`, size: 42 },
  ...a.map((v, i) => ({ id: `c${i}`, type: 'box', x: X(i), y: ROW, w: 106, h: 92, label: String(v), size: 32 })),
  ...a.map((v, i) => ({ id: `i${i}`, type: 'text', x: X(i), y: 390, text: String(i), size: 17, tone: 'dim' })),
  { id: 'lo', type: 'box', shape: 'pill', x: X(0), y: 470, w: 76, h: 42, label: 'lo', size: 19, tone: 'teal' },
  { id: 'hi', type: 'box', shape: 'pill', x: X(a.length - 1), y: 470, w: 76, h: 42, label: 'hi', size: 19, tone: 'orange' },
  { id: 'mid', type: 'box', shape: 'pill', x: X((a.length - 1) >> 1), y: 200, w: 86, h: 42, label: 'mid', size: 19, tone: 'accent' },
  { id: 'code', type: 'code', x: 560, y: 700, w: 760, size: 20, title: 'binary_search.py', lines: [
    'lo, hi = 0, len(a) - 1',
    'while lo <= hi:',
    '    mid = (lo + hi) // 2',
    '    if a[mid] == target: return mid',
    '    if a[mid] < target: lo = mid + 1',
    '    else: hi = mid - 1',
  ] },
  { id: 'cmp', type: 'text', x: 1030, y: 600, value: 0, fmt: 'comparisons: {}', size: 30, align: 'start' },
  { id: 'why', type: 'note', x: 1240, y: 735, w: 420, size: 19, tone: 'ok', title: 'Why it is fast',
    text: 'Each comparison halves what is left. A million sorted items need at most 20 looks (log₂ 1,000,000 ≈ 20).' },
];

const cells = a.map((_, i) => `c${i}`);
const range = (p, q) => cells.slice(p, q + 1);

const steps = [
  { title: 'A sorted array', say: `Ten numbers, already **sorted**. We want the index of ${target}. A linear scan would check them one by one.`,
    do: [{ show: 'title' }, { show: cells, stagger: .05 }, { show: a.map((_, i) => `i${i}`), with: true, stagger: .05 }] },
  { title: 'The search range', say: '`lo` and `hi` mark where the target can still be. At the start, that is the whole array.',
    do: [{ show: 'code' }, { line: 'code', n: 1 }, { show: ['lo', 'hi'] }, { show: 'cmp', with: true }] },
];

let lo = 0, hi = a.length - 1, n = 0;
while (lo <= hi) {
  const m = (lo + hi) >> 1;
  n++;
  steps.push({
    title: `Look at the middle (index ${m})`,
    say: `mid = (${lo} + ${hi}) // 2 = ${m}, and a[${m}] is **${a[m]}**. One comparison against ${target} decides which half to keep.`,
    do: [
      { line: 'code', n: 3 },
      n === 1 ? { show: 'mid' } : { move: 'mid', to: `c${m}`, dy: -120 },
      { highlight: `c${m}` },
      { set: 'cmp', value: n, with: true },
    ],
  });
  if (a[m] === target) {
    steps.push({
      title: `Found ${target} at index ${m}`,
      say: `a[${m}] equals the target, so we return ${m}. It took **${n} comparisons**; a linear scan needs ${m + 1}.`,
      do: [
        { line: 'code', n: 4 },
        { set: `c${m}`, tone: 'ok' },
        { highlight: `c${m}`, tone: 'ok', with: true },
        { pulse: `c${m}`, tone: 'ok', with: true },
        { camera: [`c${m}`, 'mid', 'lo', 'hi'], pad: 120 },
      ],
    });
    break;
  }
  const left = a[m] < target;
  const drop = left ? range(lo, m) : range(m, hi);
  steps.push({
    title: left ? `${a[m]} < ${target}: drop the left half` : `${a[m]} > ${target}: drop the right half`,
    say: left
      ? `Everything up to index ${m} is ${a[m]} or smaller, so ${target} cannot be there. lo jumps to ${m + 1}.`
      : `Everything from index ${m} on is ${a[m]} or bigger, so ${target} cannot be there. hi drops to ${m - 1}.`,
    do: [
      { line: 'code', n: left ? 5 : 6 },
      { unhighlight: `c${m}` },
      { set: drop, tone: 'muted', alpha: .3, with: true },
      { move: left ? 'lo' : 'hi', to: `c${left ? m + 1 : m - 1}`, dy: 150 },
    ],
  });
  if (left) lo = m + 1; else hi = m - 1;
}

steps.push({
  title: 'Why it scales', say: 'Halving is what makes it fast: doubling the array adds only **one** more comparison.',
  do: [{ camera: 'canvas' }, { show: 'why' }],
});

Motion.scene({
  title: 'Binary search',
  subtitle: `Finding ${target} in a sorted array by halving the search range`,
  eyebrow: 'Algorithm',
  elements,
  steps,
});
