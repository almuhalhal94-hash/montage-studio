// Player control tests. test/run.sh appends this to a scene and builds it;
// results land in the lint block, so `motion check` reports failures as errors.
document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('lint');
  const p = Motion.player, C = p.C, S = C.steps, eps = 1e-6;
  let pass = 0;
  const ok = (name, cond, info) => {
    if (cond) pass++;
    else out.textContent += `error test: ${name}${info === undefined ? '' : ` (got ${JSON.stringify(info)})`}\n`;
  };
  const run = (secs) => { for (let i = 0; i < secs * 60; i++) p.tick(1 / 60); p.render(); };
  const near = (a, b) => Math.abs(a - b) < 1e-3;

  ok('starts paused at 0', p.t === 0 && !p.playing);
  ok('caption shows step 1', document.getElementById('capt').textContent === S[0].title);

  p.next();
  ok('next from start plays step 1', p.playing && near(p.until, S[0].rest));
  run(S[0].rest + 1);
  ok('step-play pauses at the rest of step 1', !p.playing && near(p.t, S[0].rest), p.t);

  p.next();
  ok('next from rest jumps to step 2 start', near(p.t, S[1].t0) && p.playing);
  run(S[1].rest - S[1].t0 + 1);
  ok('then pauses at rest of step 2', !p.playing && near(p.t, S[1].rest), p.t);

  p.seek((S[2].t0 + S[2].rest) / 2);
  p.next();
  ok('next mid-animation completes the step', near(p.t, S[2].rest) && !p.playing, p.t);

  p.prev();
  ok('prev from rest goes to previous rest', near(p.t, S[1].rest), p.t);
  p.seek((S[3].t0 + S[3].rest) / 2);
  p.prev();
  ok('prev mid-animation goes to the rest before it', near(p.t, S[2].rest), p.t);

  p.seek(0);
  p.play();
  const want = S[2].t1 + .5;
  run(want);
  ok('continuous play crosses step boundaries', p.playing && Math.abs(p.t - want) < .05, p.t);
  p.pause();

  p.toggleStep();
  p.seek(S[1].rest);
  p.play();
  run(30);
  ok('step mode stops at the next rest', !p.playing && near(p.t, S[2].rest), p.t);
  p.toggleStep();

  p.seek(C.total);
  p.play();
  ok('play at the end restarts', p.t === 0 && p.playing);
  p.pause();

  p.seek(C.total); p.render();
  p.seek(S[1].rest); p.render();
  ok('scrubbing back restores the earlier state exactly', JSON.stringify(p.S) === JSON.stringify(Motion.stateAt(C, S[1].rest)));
  ok('hash tracks the step', location.hash === '#2', location.hash);
  ok('caption tracks the step', document.getElementById('capt').textContent === S[1].title);

  p.zoomBy(2);
  run(1);
  ok('zoom in doubles the zoom', Math.abs(C.W / p.ucam.w - 2) < .01, C.W / p.ucam.w);
  ok('zoom hud shows 200%', document.getElementById('zoomv').textContent === '200%', document.getElementById('zoomv').textContent);
  const shown = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  ok('follow button visible while zoomed', shown('follow'));
  p.fitView();
  run(1.5);
  ok('fit hands the camera back to the timeline', p.ucam === null);
  ok('follow button hidden while following', !shown('follow'));
  ok('help and chapters start hidden', !shown('help') && !shown('chap'));

  p.seek(S[1].rest);
  dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  ok('ArrowRight steps forward', near(p.t, S[2].t0) && p.playing, p.t);
  dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  ok('Space pauses', !p.playing);
  const bp = document.getElementById('bPlay');
  bp.focus();
  bp.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  ok('Space on a focused button is left to the button', !p.playing);
  bp.blur();
  dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
  ok('] speeds up', p.rate === 1.5, p.rate);

  const svg = document.getElementById('svg'), r = svg.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  p.fitView(); run(1.5);
  svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
  run(1);
  ok('wheel zooms in at the pointer', p.ucam && p.ucam.w < C.W * .7, p.ucam && p.ucam.w);
  const w0 = p.ucam.w, x0 = p.ucam.x;
  svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, button: 0, pointerId: 1, bubbles: true }));
  svg.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 100, clientY: cy, pointerId: 1, bubbles: true }));
  svg.dispatchEvent(new PointerEvent('pointerup', { clientX: cx + 100, clientY: cy, pointerId: 1, bubbles: true }));
  run(.2);
  ok('drag pans without zooming', p.ucam.x < x0 - 10 && Math.abs(p.ucam.w - w0) < .01, [x0, p.ucam.x]);
  p.fitView(); run(1.5);
  p.seek(S[1].rest); p.render();
  document.querySelector('[data-id="c3"] path').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  run(1.5);
  ok('double-click zooms into that element', p.ucam && C.W / p.ucam.w > 3, p.ucam && C.W / p.ucam.w);
  svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 }));
  run(1.5);
  ok('double-click on the background fits again', p.ucam === null);
  const seg = document.querySelectorAll('.seg')[2].getBoundingClientRect(), tl = document.getElementById('tl');
  tl.dispatchEvent(new PointerEvent('pointerdown', { clientX: seg.left + seg.width / 2, clientY: seg.top + 2, pointerId: 2, bubbles: true }));
  tl.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, bubbles: true }));
  ok('clicking the timeline seeks into that step', p.t > S[2].t0 && p.t < S[2].t1 && !p.playing, p.t);

  ok('state is a pure function of time', JSON.stringify(Motion.stateAt(C, 3.3)) === JSON.stringify(Motion.stateAt(C, 3.3)));
  ok('steps are contiguous', S.every((s, i) => i === 0 || Math.abs(s.t0 - S[i - 1].t1) < eps));
  out.textContent += `test-pass ${pass}\n`;
});
