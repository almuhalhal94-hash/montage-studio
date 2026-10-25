// Written by your pipeline: python3 scripts/vo_assemble.py builds plan/vo_words.json; a one-liner turns it into this file:
//   python3 -c "import json; open('src/data.js','w').write('window.DATA = ' + json.dumps({'words': json.load(open('plan/vo_words.json')), 'size': [1920, 1080]}) + ';')"
// This example line lets the template render before you have a voiceover.
window.DATA = {
  size: [1920, 1080],
  words: [
    { w: 'This', s: 0.6, e: 0.85, line: 'hook' }, { w: 'is', s: 0.85, e: 1.0, line: 'hook' }, { w: 'your', s: 1.0, e: 1.2, line: 'hook' },
    { w: 'first', s: 1.2, e: 1.55, line: 'hook' }, { w: 'scene.', s: 1.55, e: 2.1, line: 'hook' },
  ],
  dur: 4.5,
};
