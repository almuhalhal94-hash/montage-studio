// One File Studio: run this in a Pinterest search-results page (the browser tool's JavaScript runner).
// It scrolls a few screens to load more pins, then returns JSON: [{pin, alt, orig}], where orig is the
// original-resolution image URL. Save the result as picks.json (keep only the pins you chose by eye),
// then: python3 scripts/fetch_images.py picks.json assets/images/pinterest --min 1600
(async () => {
  for (let i = 0; i < 3; i++) { window.scrollBy(0, 2200); await new Promise(r => setTimeout(r, 1400)); }
  const seen = new Set(), out = [];
  document.querySelectorAll('[data-test-id="pin"], div[data-grid-item="true"]').forEach(p => {
    const img = p.querySelector('img'), a = p.querySelector('a[href*="/pin/"]');
    if (!img || !a) return;
    const src = img.currentSrc || img.src; if (!src.includes('pinimg')) return;
    const orig = src.replace(/\/\d+x(\d+)?\//, '/originals/'); if (seen.has(orig)) return; seen.add(orig);
    out.push({ pin: a.href.split('?')[0], alt: (img.alt || '').slice(0, 120), orig });
  });
  window.scrollTo(0, 0);
  return JSON.stringify(out);
})();
