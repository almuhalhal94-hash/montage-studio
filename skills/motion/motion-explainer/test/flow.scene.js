// Flow hand-off tests: a packet passes through a component instead of vanishing at it.
// test/run.sh builds this file; results land in the lint block.
Motion.scene({ title: 'Flow hand-off', elements: [
  { id: 'a', type: 'box', x: 300, y: 450, label: 'Browser' },
  { id: 'b', type: 'box', x: 800, y: 450, label: 'API' },
  { id: 'c', type: 'box', x: 1300, y: 450, label: 'Database' },
  { id: 'a1', type: 'arrow', from: 'a', to: 'b' },
  { id: 'a2', type: 'arrow', from: 'b', to: 'c' },
], steps: [
  { title: 'chained', say: 'Two flows through b.', do: [{ show: ['a', 'b', 'c', 'a1', 'a2'] }, { flow: 'a1' }, { pulse: 'c', dur: .8 }, { flow: 'a2' }] },
  { title: 'one flow', say: 'One flow over both arrows.', do: [{ flow: ['a1', 'a2'], dur: 2.4 }] },
  { title: 'far apart', say: 'A long gap: no hand-off.', do: [{ flow: 'a1' }, { wait: 4 }, { flow: 'a2' }] },
] });
document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('lint'), p = Motion.player, C = p.C;
  let pass = 0;
  const ok = (name, cond, info) => {
    if (cond) pass++;
    else out.textContent += `error test: ${name}${info === undefined ? '' : ` (got ${JSON.stringify(info)})`}\n`;
  };
  // The packet's white core, and whether it sits inside box b.
  const core = t => {
    p.seek(t); p.render();
    return [...p.stage.gfx.querySelectorAll('circle')].filter(c => c.getAttribute('fill') === '#fff').map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }));
  };
  const inB = q => q.x > 700 && q.x < 900 && q.y > 405 && q.y < 495;
  const holds = C.fx.filter(f => f.k === 'hold'), flows = C.fx.filter(f => f.k === 'flow');
  ok('chained flows through the same box share one packet', holds.length === 1 && holds[0].node === 'b', holds.map(h => h.node));
  ok('flows far apart are not chained', !flows[3].prev && !flows[2].next, [!!flows[2].next, !!flows[3].prev]);
  const h = holds[0];
  const mid = core((h.t0 + h.t1) / 2);
  ok('mid hand-off the packet rests inside the box', mid.length === 1 && inB(mid[0]), mid);
  ok('the box shows a progress ring while it holds the packet', !!p.stage.gfx.querySelector('path[pathLength="1"]'));
  const gaps = [h.t0 - .01, h.t0 + .01, h.t1 - .01, h.t1 + .01].map(t => core(t).length);
  ok('the packet never vanishes at the hand-off', gaps.every(n => n === 1), gaps);
  const m = flows[2], inside = core(m.t0 + (m.t1 - m.t0) / 2);
  ok('a multi-arrow flow passes through the shared box', inside.length === 1 && inB(inside[0]), inside);
  const land = flows[3];
  core(land.t1 + .2);
  ok('a landing leaves a ripple after the flow ends', p.stage.gfx.querySelectorAll('circle').length > 0);
  out.textContent += `test-pass ${pass}\n`;
});
