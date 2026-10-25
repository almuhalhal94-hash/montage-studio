// Resource tests: icons, kinetic text, frames, charts, particles, the hud theme and their lint.
// test/run.sh appends this to examples/showcase.scene.js and builds it; failures land in the lint block.
document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('lint');
  const p = Motion.player, C = p.C, st = p.stage;
  let pass = 0;
  const ok = (name, cond, info) => {
    if (cond) pass++;
    else out.textContent += `error test: ${name}${info === undefined ? '' : ` (got ${JSON.stringify(info)})`}\n`;
  };
  const tween = (id, prop) => C.tweens.find(w => w.id === id && w.p === prop && (prop !== 'op' || w.b === 1));
  const at = (id, prop, f) => { const w = tween(id, prop); return w.t0 + f * (w.t1 - w.t0); };
  const node = id => st.nodes[id];

  const names = Object.keys(MOTION_ICONS), svg = document.getElementById('svg');
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.appendChild(probe);
  const bad = names.filter(k => {
    probe.setAttribute('d', MOTION_ICONS[k]);
    return !/^M[MLHVCSQTAZmlhvcsqtaz0-9., -]+$/.test(MOTION_ICONS[k]) || !(probe.getTotalLength() > 0);
  });
  probe.remove();
  ok('every icon is a drawable path', names.length >= 50 && !bad.length, bad);

  const rest = k => C.steps[k].rest;
  st.paint(rest(1));
  ok('a named box icon is drawn as a path', node('repo').iconp.getAttribute('d') === MOTION_ICONS['git-branch'] && node('repo').icon.textContent === '');

  const full = 'All systems operational';
  st.paint(at('oktext', 'op', .5));
  ok('type shows the first half and a caret', node('oktext').lab.textContent === full.slice(0, Math.floor(full.length * .5)) + '\u258d', node('oktext').lab.textContent);
  st.paint(rest(4));
  ok('type ends with the full text', node('oktext').lab.textContent === full, node('oktext').lab.textContent);

  st.paint(at('hero', 'op', .3));
  const words = Array.from(node('hero').lab.querySelectorAll('tspan tspan')), op = words.map(w => +w.getAttribute('opacity'));
  ok('words fade in one after another', words.length === 5 && op[0] > op[4] && words.map(w => w.textContent.trim()).join(' ') === 'From git push to production', op);

  const t = at('done', 'op', .5);
  st.paint(t);
  const s1 = node('done').lab.textContent;
  st.paint(rest(4));
  st.paint(t);
  ok('scramble keeps the settled half and is the same on every paint', s1.startsWith('Ship') && s1.length === 8 && s1 !== 'Shipped.' && node('done').lab.textContent === s1, s1);
  st.paint(rest(5));
  ok('scramble settles on the text', node('done').lab.textContent === 'Shipped.');

  const tt = at('term', 'typed', .5), N = C.by.term.lines.join('').length;
  const S = st.paint(tt);
  ok('a terminal types its lines', node('term').lines.textContent.length === Math.round(N * S.term.typed) && node('term').caret.getAttribute('display') === 'inline',
    [node('term').lines.textContent.length, Math.round(N * S.term.typed)]);
  st.paint(rest(1));
  ok('then shows every line', node('term').lines.textContent.length === N);

  const dw = tween('times', 'data');
  ok('set data tweens a chart', JSON.stringify(Motion.stateAt(C, dw.t0).times.data) === '[14,11,9,12]' && JSON.stringify(Motion.stateAt(C, dw.t1).times.data) === '[6,4,3,2]');
  st.paint(rest(3));
  const bh = node('times').bars.map(b => +b.getAttribute('height'));
  ok('bars are drawn to scale', bh[0] > bh[1] && bh[1] > bh[2] && bh[2] > bh[3] && bh[3] > 0, bh);
  st.paint(rest(5));
  ok('a line chart draws every point', node('errs').pts.every(c => c.getAttribute('opacity') === '1'));

  const po = el => +el.getAttribute('opacity');
  st.paint(at('pop', 'op', .4));
  const mid = node('pop').pts.map(q => po(q.el));
  st.paint(rest(5));
  ok('a burst flies out, then fades', mid.some(v => v > .3) && node('pop').pts.every(q => po(q.el) === 0));

  p.seek(rest(2)); p.render();
  ok('hud shows the step, number and timecode', !document.getElementById('bcast').hidden &&
    document.getElementById('bcNum').textContent === 'STEP 03 / 06' && /^\d\d:\d\d:\d\d:\d\d$/.test(document.getElementById('bcTime').textContent),
    document.getElementById('bcNum').textContent);

  const issues = spec => Motion.compile(spec).issues.map(i => `${i.lvl} ${i.msg}`).join('\n');
  const one = (els, steps) => ({ elements: els, steps: steps || [{ title: 'a', say: 'a', do: [{ show: els.map(e => e.id) }] }] });
  ok('lint: unknown icon name', /error icon 'i': unknown name 'nope'/.test(issues(one([{ id: 'i', type: 'icon', name: 'nope' }]))));
  ok('lint: box icon that looks like a name', /'b': 'servr' is not a known icon/.test(issues(one([{ id: 'b', type: 'box', icon: 'servr' }]))));
  ok('lint: emoji box icon is fine', issues(one([{ id: 'b', type: 'box', icon: '\u{1F680}' }])) === '');
  ok('lint: chart with no data', /error chart 'c' has no data/.test(issues(one([{ id: 'c', type: 'chart' }]))));
  ok('lint: set data of the wrong length', /error set: chart 'c' has 2 values, data has 3/.test(issues(one([{ id: 'c', type: 'chart', data: [1, 2] }],
    [{ title: 'a', say: 'a', do: [{ show: 'c' }, { set: 'c', data: [1, 2, 3] }] }]))));
  ok('lint: unknown icon name in set', /error set: icon 'i': unknown name 'nope'/.test(issues(one([{ id: 'i', type: 'icon', name: 'gear' }],
    [{ title: 'a', say: 'a', do: [{ show: 'i' }, { set: 'i', name: 'nope' }] }]))));
  ok('lint: unknown box icon in set', /warn set: 'b': 'servr' is not a known icon/.test(issues(one([{ id: 'b', type: 'box', icon: 'gear' }],
    [{ title: 'a', say: 'a', do: [{ show: 'b' }, { set: 'b', icon: 'servr' }] }]))));
  ok('lint: object built-ins are not icons', /unknown name 'constructor'/.test(issues(one([{ id: 'i', type: 'icon', name: 'constructor' }]))));
  ok('lint: unknown chart kind and particle mode', /warn chart 'c': unknown kind 'pie'/.test(issues(one([{ id: 'c', type: 'chart', kind: 'pie', data: [1] }]))) &&
    /warn particles 'p': unknown mode 'snow'/.test(issues(one([{ id: 'p', type: 'particles', mode: 'snow' }]))));
  ok('lint: unknown backdrop', /warn unknown backdrop 'stars'/.test(issues(Object.assign(one([{ id: 'x', type: 'text', text: 'x' }]), { backdrop: 'stars' }))));
  ok('lint: the new eases are known', issues(one([{ id: 'x', type: 'text', text: 'x' }],
    [{ title: 'a', say: 'a', do: ['bounce', 'elastic', 'anticipate'].map(e => ({ move: 'x', dx: 10, ease: e })) }])) === '');

  p.flipTheme();
  st.paint(rest(1));
  const term = (node('term').body.getAttribute('fill').match(/\d+/g) || []).map(Number);
  ok('a terminal stays light in the light theme', term.length === 3 && term.every(v => v > 220), term);
  ok('light theme hides the hud', document.getElementById('bcast').hidden && document.documentElement.dataset.theme === 'light');
  p.flipTheme();
  ok('and flipping back restores it', !document.getElementById('bcast').hidden && document.documentElement.dataset.theme === 'hud');

  out.textContent += `test-pass ${pass}\n`;
});
