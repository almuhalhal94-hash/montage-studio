// Example scene: a photo stage with a slow push-in, embers, a title that blurs in word by word, and synced captions.
// Copy this file per scene. Every time comes from a spoken word (A.ws / A.we), never a hard-coded second.
A.build(() => {
  const { TL, el, $ } = A, ws = A.ws, we = A.we, K = A.K;
  const s1 = el(`<div id="s1" class="scene" style="visibility:visible;opacity:1">
      <div class="stage" id="st1"><img src="../assets/images/example.jpg"></div>
      <canvas id="emb1" class="layer"></canvas>
      <div class="abs title nw" id="t1">Your <span class="hl">first</span> scene.</div></div>`);
  // camera over the photo: cover-fit, then a slow push (the camera always moves a little)
  const st = A.stage($('#st1'), 2064, 1152), cam = { z: 1.0, x: 0, y: 0 };
  A.addDraw(t => A.photoCam(st, cam));
  TL.fromTo(cam, { z: 1.0 }, { z: 1.08, duration: A.D.dur, ease: 'none' }, 0);
  // title words land on the spoken words
  K.title = ws('hook', 0) - .14;
  A.sync(A.split($('#t1')), 'hook', 2, .14, { y: 22, blur: 12, dur: .6 });   // title word i lands on spoken word 2 + i
  // embers rising from the window area, fading in after the title
  const ember = A.embers($('#emb1'), { seed: 5, n: 60 });
  A.addDraw(t => ember(t, { x: 1100, y: 360, w: 420, h: 260 }, Math.min(1, Math.max(0, (t - K.title) / .6))));
  A.caption('hook', { hl: [3] });
  // end: fade to black
  TL.to(s1, { opacity: 0, duration: .5, ease: 'power1.in' }, A.D.dur - .5);
});
