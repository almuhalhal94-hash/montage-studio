// Lint for zoomed-in insides (minZoom): each problem below must produce its warning.
Motion.scene({ title: 'Zoom lint', elements: [
  { id: 'svc', type: 'box', x: 800, y: 450, w: 400, h: 200, label: 'Service', labelMaxZoom: 2 },
  { id: 'tall', type: 'box', x: 700, y: 430, w: 90, h: 40, icon: 'clock', label: 'Too tall', size: 9, minZoom: 2 },
  { id: 'out', type: 'box', x: 990, y: 430, w: 90, h: 64, label: 'Out', size: 9, minZoom: 2 },
  { id: 'p', type: 'box', x: 820, y: 430, w: 90, h: 64, label: 'P', size: 9, minZoom: 2 },
  { id: 'q', type: 'box', x: 860, y: 440, w: 90, h: 64, label: 'Q', size: 9, minZoom: 2 },
  { id: 'under', type: 'arrow', from: 'tall', to: 'p', minZoom: 2, layer: 1 },
  { id: 'fine', type: 'box', x: 300, y: 450, w: 200, h: 120, label: 'Fine' },
  { id: 'f1', type: 'box', x: 255, y: 450, w: 70, h: 60, label: 'A', size: 9, minZoom: 2 },
  { id: 'f2', type: 'box', x: 345, y: 450, w: 70, h: 60, label: 'B', size: 9, minZoom: 2 },
  { id: 'fa', type: 'arrow', from: 'f1', to: 'f2', minZoom: 2 },
], steps: [{ title: 'all', say: 'Everything.', do: [{ show: ['svc', 'tall', 'out', 'p', 'q', 'under', 'fine', 'f1', 'f2', 'fa'] }] }] });
