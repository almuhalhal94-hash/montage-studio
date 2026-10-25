// Voice sync tests. test/run.sh appends this to a scene and writes a fake voice.js beside it (step 1:
// af_heart 30 s + 1 s, ef_dora 20 s + 1 s); audio elements are swapped for stubs, so no real media or autoplay is needed.
document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('lint');
  const p = Motion.player, S = p.C.steps;
  let pass = 0;
  const ok = (name, cond, info) => {
    if (cond) pass++;
    else out.textContent += `error test: ${name}${info === undefined ? '' : ` (got ${JSON.stringify(info)})`}\n`;
  };
  const run = secs => { for (let i = 0; i < secs * 60; i++) p.tick(1 / 60); p.render(); };
  const stub = () => ({ paused: true, currentTime: 0, playbackRate: 1, play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; } });
  Object.values(p.voices).flat().forEach(c => { if (c) c.el = stub(); });
  const [a, b] = [p.voice[0].el, p.voice[1].el];

  ok('step 1 stretches to fit its 30 s clip', S[0].t1 >= S[0].t0 + 30.4 - 1e-6, S[0].t1 - S[0].t0);
  ok('a narrated step ends right after its longest clip, no silent reading pause', Math.abs(S[1].t1 - Math.max(S[1].rest + .3, S[1].t0 + 1.4)) < 1e-6,
    [S[1].t0, S[1].rest, S[1].t1]);
  ok('lint reports the clips', out.textContent.includes('voice 2 clips 31.0 af_heart'), out.textContent.split('\n').find(l => l.startsWith('voice')));
  ok('voice button is shown', document.getElementById('bVoice')?.textContent === 'Voice on');

  p.play();
  run(1);
  ok('playing starts the step 1 clip at the playhead', !a.paused && Math.abs(a.currentTime - p.t) < .35, [a.paused, a.currentTime, p.t]);
  p.pause();
  run(.1);
  ok('pause pauses the clip', a.paused);

  p.toggleVoice();
  p.play();
  run(.5);
  ok('muted: clip stays paused', a.paused && document.getElementById('bVoice').textContent === 'Voice off');
  p.toggleVoice();
  run(.1);
  ok('unmuted: clip resumes', !a.paused);

  p.rate = 2;
  run(.1);
  ok('clip follows the speed', a.playbackRate === 2, a.playbackRate);
  p.rate = 1;

  p.pause();
  p.seek(0);
  p.next();
  run(2);
  ok('next plays on until the narration ends, not just the animation', p.playing && !a.paused
    && Math.abs(p.until - (S[0].t0 + 30)) < 1e-6, [p.playing, p.until]);
  p.pause();
  p.toggleStep();
  p.seek(S[0].t0);
  p.play();
  ok('step mode stops after the narration', Math.abs(p.until - (S[0].t0 + 30)) < 1e-6, p.until);
  p.toggleStep();
  p.pause();
  p.seek(0);
  p.next();
  p.toggleVoice();
  ok('muting while stepping moves the stop back to the rest', p.stopOf(0) === S[0].rest && p.until === S[0].rest, p.until);
  p.toggleVoice();
  ok('unmuting while stepping moves it out to the narration end', Math.abs(p.until - (S[0].t0 + 30)) < 1e-6, p.until);
  p.pause();

  p.play();
  p.seek(S[1].t0 + .5);
  run(.1);
  ok('seeking into step 2 pauses clip 1 and plays clip 2 at its offset', a.paused && !b.paused && Math.abs(b.currentTime - .6) < .35,
    [a.paused, b.paused, b.currentTime]);
  p.seek(S[2].t0);
  run(.1);
  ok('a step without a clip leaves every clip paused', a.paused && b.paused);
  p.pause();

  const pick = document.getElementById('sVoice'), d = p.voices.ef_dora[0].el;
  ok('picker lists every voice, first one playing', pick && [...pick.options].map(o => o.value).join() === 'af_heart,ef_dora' && p.voice === p.voices.af_heart);
  ok('picker shows names, not ids', [...pick.options].map(o => o.textContent).join() === 'Heart,Dora', [...pick.options].map(o => o.textContent));
  p.seek(0);
  p.play();
  run(.5);
  p.setVoice('ef_dora');
  run(.1);
  ok('switching voice pauses the old clip and plays the new one at the playhead', a.paused && !d.paused && Math.abs(d.currentTime - p.t) < .35,
    [a.paused, d.paused, d.currentTime, p.t]);
  ok('the stop follows the picked voice', Math.abs(p.stopOf(0) - (S[0].t0 + 20)) < 1e-6, p.stopOf(0));
  p.pause();

  out.textContent += `test-pass ${pass}\n`;
});
