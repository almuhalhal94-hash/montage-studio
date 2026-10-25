"""Writes src/data_h{1,2,3}.js: cuts, the hook text and every narrator word on the absolute timeline."""
import json
W = json.load(open('plan/vo_tight_words.json'))
CUT = {'s0': .33, 's1': 1.00, 'hook': 1.12, 'door': 3.95, 'hall': 6.75, 'cor': 9.15, 'fig': 10.75, 'blk': 11.95, 'tw': 12.10, 'pitch': 14.30, 'dur': 24.2}
AT = {'hook': 1.20, 'nocam': 4.05, 'onefile': 6.85, 'every': 12.35, 'pitch': 14.45}
HOOKS = {1: ('hA', 'What if you could make <span class="o">videos like this…</span>'), 2: ('hB', 'This haunted house <span class="o">doesn\'t exist.</span>'),
         3: ('hC', 'Claude made this… <span class="o">and I can\'t sleep.</span>')}
FIXW = {('onefile', 'in'): 'and'}
for n, (hid, htxt) in HOOKS.items():
    words = []
    for line, lid in (('hook', hid), ('nocam', 'nocam'), ('onefile', 'onefile'), ('every', 'every'), ('pitch', 'pitch')):
        for x in W[lid]:
            words.append({'w': FIXW.get((lid, x['w']), x['w']), 's': round(AT[line] + x['s'], 3), 'e': round(AT[line] + x['e'], 3), 'line': line})
    D = {'size': [1080, 1920], 'fps': 24, 'dur': CUT['dur'], 'cut': CUT, 'at': AT, 'hook': n, 'hookText': htxt, 'hookId': hid, 'words': words,
         'keyword': 'SKILL', 'handle': '@elibrandow', 'displayName': 'Eli Brandow', 'fonts': ['500 40px SG', '700 40px SG', '400 30px JB', '700 40px CinzelD']}
    open(f'src/data_h{n}.js', 'w').write('window.DATA = ' + json.dumps(D) + ';\n')
    open(f'src/index_h{n}.html', 'w').write(f"""<!doctype html>
<html><head><meta charset="utf-8"><title>haunted house h{n}</title><link rel="stylesheet" href="scary.css"></head>
<body><div id="root"><img id="seq" class="layer" alt=""><div id="scenes" class="layer"></div><canvas id="fx" class="layer"></canvas><div id="hud" class="layer"></div><div id="flash" class="layer"></div><div id="vig" class="layer"></div><canvas id="grain" class="layer"></canvas></div>
<script src="../assets/vendor/gsap.min.js"></script><script src="data_h{n}.js"></script><script src="engine.js"></script><script src="scary.js"></script><script src="boot.js"></script>
</body></html>""")
print('ok', [w['w'] for w in words if w['line'] == 'pitch'][:6])
