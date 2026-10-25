// Boot: fonts and images, build every scene, then expose renderFrame(t) for scripts/render.mjs.
(async () => {
  await Promise.all((A.D.fonts || ['600 40px SG', '700 40px SG']).map(f => document.fonts.load(f, 'Aa✻')));
  await document.fonts.ready;
  for (const b of A.builders) await b();
  await Promise.all(A.$$('img').filter(im => im.getAttribute('src')).map(im => im.complete && im.naturalWidth ? 1 : im.decode().catch(() => { throw new Error('image failed: ' + im.src); })));
  A.D.dur = A.D.dur || (A.D.words.length ? A.D.words[A.D.words.length - 1].e + 2 : 5);
  window.renderFrame = async t => {
    A.TL.seek(t, true);
    const ps = []; for (const d of A.drawers) { const p = d(t); if (p && p.then) ps.push(p); }   // drawers may return a promise (image-sequence decodes)
    await Promise.all(ps);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return true;
  };
  window.__ready = true;
})().catch(e => { window.__err = String(e && e.stack || e); window.__ready = true; });
