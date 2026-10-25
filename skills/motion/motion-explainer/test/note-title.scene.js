// Regression scene: a long note title wraps (the note grows), and a title word wider than the note is flagged.
Motion.scene({
  title: 'note titles',
  elements: [
    { id: 'wrap', type: 'note', x: 400, y: 250, w: 300, title: 'A long title that has to wrap onto a second line', text: 'body' },
    { id: 'wide', type: 'note', x: 1100, y: 250, w: 200, title: 'Supercalifragilisticexpialidocious', text: 'body' },
  ],
  steps: [{ title: 'one', say: 'Both notes.', do: [{ show: ['wrap', 'wide'] }] }],
});
document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('lint'), n = Motion.player.C.init.wrap;
  const oneLine = 30 + 17 * 1.35 + 4 + 17 * 1.45;
  if (n.h > oneLine + 17) out.textContent += 'test-pass 1\n';
  else out.textContent += `error test: wrapped title did not grow the note (h ${n.h})\n`;
});
