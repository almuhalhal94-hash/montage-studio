// THE HAUNTED HOUSE: black + top text, a jump scare, the hook over the mansion, the door, the stair hall, the portrait
// corridor, the figure, then it freezes into Claude Code ("Claude made every frame.") and the one-file pitch.
A.build(() => {
  const { TL, el, $, $$, split } = A, D = A.D, C = D.cut, FPS = D.fps, EPS = 1 / (2 * FPS), ws = A.ws, we = A.we;
  const f = t => Math.round(t * FPS);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), io = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const R = A.seed(13), shakeTab = Array.from({ length: 2000 }, () => [R() * 2 - 1, R() * 2 - 1]);

  // ---- picture: frame-locked image sequences of the six Kling clips ----
  const SEQ = [
    { c: 'c0_scare', f0: f(C.s0), f1: f(C.s1) - 1, a: 56, b: 96, shake: 34, punch: [1.0, 1.18] },
    { c: 'c1_mansion', f0: f(C.hook), f1: f(C.door) - 1, a: 0, b: 67, push: [1.0, 1.06] },
    { c: 'c2_door', f0: f(C.door), f1: f(C.hall) - 1, a: 0, b: 66, push: [1.02, 1.1] },
    { c: 'c3_hall', f0: f(C.hall), f1: f(C.cor) - 1, a: 8, b: 66, push: [1.0, 1.05] },
    { c: 'c4_corridor', f0: f(C.cor), f1: f(C.fig) - 1, a: 18, b: 56, push: [1.0, 1.04] },
    { c: 'c5_figure', f0: f(C.fig), f1: f(C.blk) - 1, a: 26, b: 96, shake: 22, punch: [1.0, 1.12] }];
  const img = $('#seq'); let curSrc = '';
  A.addDraw(t => {
    const fr = f(t), s = SEQ.find(q => fr >= q.f0 && fr <= q.f1);
    if (!s) { img.style.visibility = 'hidden'; return; }
    img.style.visibility = 'visible';
    const u = (fr - s.f0) / Math.max(1, s.f1 - s.f0), k = Math.round(s.a + u * (s.b - s.a));
    let sc = s.push ? s.push[0] + (s.push[1] - s.push[0]) * u : 1, dx = 0, dy = 0;
    if (s.punch) sc = s.punch[0] + (s.punch[1] - s.punch[0]) * u * u;
    if (s.shake) { const [a, b] = shakeTab[fr % 2000], amp = s.shake * (.35 + .65 * u); dx = a * amp; dy = b * amp; }
    img.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    const src = `../assets/clips/house/${s.c}/f${String(k).padStart(3, '0')}.jpg`;
    if (src === curSrc) return; curSrc = src; img.src = src; return img.decode().catch(() => {});
  });
  // the scare's flash frames + a black beat after each scare
  TL.fromTo('#flash', { opacity: 0 }, { keyframes: [{ opacity: .95, duration: 1 / FPS }, { opacity: 0, duration: 1 / FPS }, { opacity: .7, duration: 1 / FPS }, { opacity: 0, duration: 2 / FPS }] }, C.s1 - 4 / FPS);
  TL.fromTo('#flash', { opacity: 0 }, { keyframes: [{ opacity: .6, duration: 1 / FPS }, { opacity: 0, duration: 2 / FPS }] }, C.blk - 3 / FPS);

  // ---- top text from frame 0 ----
  // no baked top text: Eli adds his own on-screen text in the app (10/11)

  // ---- light snow outside only (the mansion + the porch) ----
  const fx = $('#fx'), cx = fx.getContext('2d'); fx.width = 1080; fx.height = 1920; const rs = A.seed(5);
  const SNOW = Array.from({ length: 140 }, () => ({ x: rs() * 1080, y: rs() * 2000, v: 60 + rs() * 120, s: .8 + rs() * 2.6, sw: 10 + rs() * 30, p: rs() * 6.28, a: .25 + rs() * .5 }));
  const DUST = Array.from({ length: 70 }, () => ({ x: rs() * 1080, y: rs() * 1920, v: 6 + rs() * 16, s: .6 + rs() * 1.6, p: rs() * 6.28, a: .15 + rs() * .35 }));
  A.addDraw(t => {
    cx.clearRect(0, 0, 1080, 1920);
    if (t >= C.hook && t < C.hall) SNOW.forEach(p => { const y = ((p.y + p.v * t) % 2000) - 40, x = p.x + Math.sin(t * .9 + p.p) * p.sw; cx.fillStyle = `rgba(235,240,255,${p.a})`; cx.beginPath(); cx.arc(x, y, p.s, 0, 6.283); cx.fill(); });
    if (t >= C.hall && t < C.fig) DUST.forEach(p => { const y = ((p.y - p.v * t) % 1920 + 1920) % 1920, x = p.x + Math.sin(t * .5 + p.p) * 18; cx.fillStyle = `rgba(255,220,170,${p.a * (.6 + .4 * Math.sin(t * 2 + p.p))})`; cx.beginPath(); cx.arc(x, y, p.s, 0, 6.283); cx.fill(); });
  });

  // ---- the hook: big, centred on a dark band; each version's own line ----
  const hb = el(`<div id="hband"></div>`, '#hud'), hk = el(`<div id="hk">${D.hookText}</div>`, '#hud');
  gsap.set([hb, hk], { autoAlpha: 0 }); TL.set(hb, { autoAlpha: 1 }, C.hook - EPS); TL.set(hk, { autoAlpha: 1 }, C.hook - EPS);
  A.sync(split(hk), 'hook', 0, .1, { y: 22, blur: 14, dur: .26 });
  TL.fromTo(hk, { x: 0 }, { keyframes: [{ x: 10, duration: .03 }, { x: -8, duration: .03 }, { x: 0, duration: .04 }] }, C.hook + 1.62);   // the lightning
  TL.to([hb, hk], { autoAlpha: 0, duration: .12 }, C.door - .1);

  // ---- captions for the narrator in the house ----
  for (const [line, t0, t1, txt] of [['nocam', C.door, C.hall, 'No camera. No set.<br>No crew.'], ['onefile', C.hall, C.cor, 'Just Claude…<br>and <span class="o">one file.</span>']]) {
    const c = el(`<div class="cap">${txt}</div>`, '#hud'); gsap.set(c, { autoAlpha: 0 }); TL.set(c, { autoAlpha: 1 }, t0 - EPS);
    A.sync(split(c), line, 0, .08, { y: 16, blur: 10, dur: .22 }); TL.to(c, { autoAlpha: 0, duration: .15 }, t1 - .18);
  }

  // ---- twist: freeze the figure, glitch, shrink into Claude Code ----
  const tw = el(`<div id="tw" class="scene">
      <div id="twh">Claude made <span class="o">every frame.</span></div>
      <div class="win" id="win"><div class="bar"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i><span>Claude Code</span><span class="st">✻</span><span style="margin-left:auto;color:#8f88a3">~/haunted</span></div>
        <div class="ask" id="ask"></div>
        <div class="chip" id="chip"><b>✻</b><div>one-file-studio.md<small>the skill · one file</small></div></div>
        <div class="res" id="res"><div class="th" style="background-image:url(../assets/clips/house/c5_figure/f060.jpg)"></div><div class="t"><span class="g">✓</span> haunted-house.mp4<br>24 s · 9:16 · with sound<br><span style="color:#8f88a3">jump scare · 6 rooms · 1 file</span></div></div></div>
      <img id="freeze" src="../assets/clips/house/c5_figure/f060.jpg" alt=""></div>`);
  A.on(tw, C.tw - EPS); A.off(tw, C.pitch - EPS);
  const fz = $('#freeze');
  TL.fromTo(fz, { x: 0, filter: 'saturate(1) hue-rotate(0deg) contrast(1)' }, { keyframes: [{ x: 26, filter: 'saturate(2) hue-rotate(60deg) contrast(1.5)', duration: .04 }, { x: -20, duration: .04 }, { x: 12, filter: 'saturate(1.5) hue-rotate(-40deg) contrast(1.3)', duration: .04 }, { x: 0, filter: 'saturate(1) hue-rotate(0deg) contrast(1)', duration: .05 }] }, C.tw);
  TL.fromTo(fz, { x: 0, y: 0, scale: 1, borderRadius: 0 }, { x: 92, y: 1080, scale: 200 / 1080, borderRadius: 80, duration: .55, ease: 'power3.inOut' }, C.tw + .2);
  TL.set(fz, { autoAlpha: 0 }, C.tw + .78);
  A.enter('#win', { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: .4, ease: 'power3.out' }, C.tw + .22);
  A.typer($('#ask'), '› make a haunted house video. jump scare first.', C.tw + .5, C.tw + 1.15);
  A.enter('#chip', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .3, ease: 'back.out(1.8)' }, C.tw + 1.0);
  gsap.set('#res .t', { opacity: 0 }); TL.to('#res .t', { opacity: 1, duration: .25 }, C.tw + .8);
  A.sync(split($('#twh')), 'every', 0, .1, { y: 18, blur: 12, dur: .26 });

  // ---- pitch ----
  const pt = el(`<div id="pt" class="scene"><img class="bgp" id="bgp" src="../assets/images/house/k4_corridor.png" alt=""><div class="dark"></div>
      <div class="eyes" id="eyes" style="left:480px;top:700px"><i></i><i></i></div>
      <div class="ph" id="p1">Want to make videos<br><span class="o">like this?</span></div>
      <div class="ph" id="p2" style="opacity:0">It's all in<br><span class="o">one file.</span></div>
      <div class="file" id="file"><div class="ic">✻</div><div><div class="n">one-file-studio.md</div><div class="s">the skill behind this video</div></div></div>
      <div class="ph" id="p3" style="opacity:0">Comment <span class="o">"${D.keyword}"</span></div>
      <div class="prof" id="prof"><div class="av"></div><div><div class="nm">${D.displayName}</div><div class="hn">${D.handle}</div></div><div class="fb" id="fb"><span id="fbt">Follow</span></div></div>
      <div class="toast" id="toast"><div class="av"></div><div><div class="t1">elibrandow</div><div class="t2">sent you a file · <b>one-file-studio.md</b></div></div></div>
      <div class="free" id="free"><span>The first 100 get it</span><span class="pill">free.</span></div>
      <div class="bar2" id="bar2"><div class="lab">100 FREE SPOTS</div><div class="trk">${Array.from({ length: 100 }, (_, k) => `<i style="left:${(k + .5).toFixed(2)}%"></i>`).join('')}</div></div>
      <div class="paid" id="paid">After that, it's <span class="co">paid.</span></div>
      <div class="cursor" id="cur"><svg viewBox="0 0 40 50" width="64" height="80"><path d="M4 3 L4 40 L13.5 31 L20 46 L26.5 43 L20 28.5 L33 28.5 Z" fill="#fff" stroke="#111" stroke-width="2.6" stroke-linejoin="round"/></svg></div></div>`);
  A.on(pt, C.pitch - EPS); TL.fromTo('#flash', { opacity: .35 }, { opacity: 0, duration: .25 }, C.pitch);
  const P0 = C.pitch;
  A.addDraw(t => { if (t < P0 - .05) return; const u = clamp((t - P0) / (C.dur - P0)); $('#bgp').style.transform = `scale(${(1.0 + .07 * u).toFixed(4)})`;
    $('#bgp').style.filter = `brightness(${(.62 + .06 * Math.sin(t * 9) + .04 * Math.sin(t * 23)).toFixed(3)}) saturate(.95)`; });
  A.sync(split($('#p1')), 'pitch', 0, .1, { y: 18, blur: 12, dur: .26 });
  const W = i => ws('pitch', i), WE = i => we('pitch', i);
  // "It's all in one file." swaps the headline, the file card rises
  TL.to('#p1', { opacity: 0, y: -14, filter: 'blur(10px)', duration: .14 }, W(6) - .16); TL.set('#p2', { opacity: 1 }, W(6) - .02); A.sync(split($('#p2')), 'pitch', 6, .1, { y: 18, blur: 12, dur: .26 });
  A.enter('#file', { opacity: 0, y: 60, scale: .9 }, { opacity: 1, y: 0, scale: 1, duration: .42, ease: 'back.out(1.6)' }, W(9) - .1);
  // "Follow and comment skill": the profile, the click, the keyword
  const FOL = W(11) + .1;
  TL.to(['#p2', '#file'], { opacity: 0, y: -16, filter: 'blur(10px)', duration: .16 }, W(11) - .2);
  A.enter('#prof', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .32, ease: 'power3.out' }, W(11) - .12);
  TL.set('#p3', { opacity: 1 }, W(13) - .05); A.sync(split($('#p3')), 'pitch', 13, .06, { y: 18, blur: 12, dur: .24, scale: 1.2 });
  const cur = $('#cur'), fb = $('#fb'), box = $('#pt');
  const ctr = e => { const r = e.getBoundingClientRect(), o = box.getBoundingClientRect(); return [r.left - o.left + r.width / 2, r.top - o.top + r.height / 2]; };
  const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], Q0 = [900, 1250], Q1 = [980, 1400];
  A.addDraw(t => { if (t < FOL - .7 || t > FOL + .9) { cur.style.opacity = 0; } else { let p, op = 1;
      if (t < FOL - .03) { const u = clamp((t - FOL + .7) / .67); p = mix(Q0, ctr(fb), io(u)); op = clamp(u * 4); } else if (t < FOL + .3) p = ctr(fb); else { const u = clamp((t - FOL - .3) / .4); p = mix(ctr(fb), Q1, io(u)); op = 1 - u; }
      cur.style.left = (p[0] - 7).toFixed(1) + 'px'; cur.style.top = (p[1] - 5).toFixed(1) + 'px'; cur.style.opacity = op; }
    const on = t >= FOL + .08; $('#fbt').innerHTML = on ? 'Following &#10003;' : 'Follow'; fb.classList.toggle('on', on); });
  TL.fromTo('#cur', { scale: 1 }, { scale: .86, duration: .06, yoyo: true, repeat: 1, transformOrigin: '10% 6%' }, FOL);
  TL.fromTo('#fb', { scale: 1 }, { scale: .94, duration: .06, yoyo: true, repeat: 1 }, FOL);
  // "I'll send it to you."
  A.enter('#toast', { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: .4, ease: 'back.out(1.6)' }, W(15) - .05);
  // "The first hundred get it free." 100 open spots tick in (a cap, never a count)
  TL.to('#toast', { opacity: 0, y: -20, duration: .2 }, W(20) - .25);
  A.blurIn('#free', W(20) - .1, { dur: .3 }); A.enter('#bar2', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .28 }, W(20) - .05);
  const B0 = W(21), B1 = WE(25) + .1, tk = $$('#bar2 .trk i');
  A.addDraw(t => { if (t < B0 - .1) return; const u = clamp((t - B0) / (B1 - B0)); tk.forEach((e, k) => { const v = clamp((Math.pow(u, 1 / .8) * 100 - k) / 3); e.style.opacity = v.toFixed(2); e.style.transform = `translateX(-50%) scaleY(${(.2 + .8 * v).toFixed(2)})`; }); });
  A.enter('#paid', { opacity: 0, y: 20, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .3, ease: 'power3.out' }, W(26) - .1);
  TL.fromTo('#paid .co', { scale: 1.7 }, { scale: 1, duration: .35, ease: 'back.out(2.4)' }, W(28) - .02);
  // last beat: two eyes open in the dark at the end of the corridor
  TL.to('#eyes', { opacity: 1, duration: .25, ease: 'power2.in' }, C.dur - .75);
  TL.fromTo('#eyes', { scaleY: .1 }, { scaleY: 1, duration: .18, ease: 'power2.out' }, C.dur - .7);
});
