// Resource showcase: icons, kinetic type, frames, charts, the hud theme and effects in one short story.
Motion.scene({
  title: 'From git push to production',
  theme: 'hud',
  backdrop: 'grid',
  elements: [
    { id: 'dust', type: 'particles', x: 800, y: 450, w: 1600, h: 900, n: 70, mode: 'drift', alpha: .55 },
    { id: 'hero', type: 'title', x: 170, y: 410, kicker: 'Release pipeline', text: 'From git push to production', size: 84, maxw: 1100 },

    { id: 'term', type: 'frame', kind: 'terminal', x: 560, y: 330, w: 760, h: 300, title: 'zsh  ~/app', typed: 0,
      lines: ['$ git push origin main', 'Enumerating objects: 42, done.', 'To github.com:team/app.git', '   9f2c1a0..7d4e3b2  main -> main', '$ '] },
    { id: 'repo', type: 'box', x: 1250, y: 330, w: 220, h: 120, icon: 'git-branch', label: 'Repository', tone: 'accent' },
    { id: 'push', type: 'arrow', from: 'term', to: 'repo', label: 'push', glow: true },

    { id: 'build', type: 'box', x: 420, y: 640, w: 220, h: 120, icon: 'package', label: 'Build' },
    { id: 'test', type: 'box', x: 800, y: 640, w: 220, h: 120, icon: 'check', label: 'Test' },
    { id: 'ship', type: 'box', x: 1180, y: 640, w: 220, h: 120, icon: 'rocket', label: 'Deploy', tone: 'accent', fx: 'bounce' },
    { id: 'a1', type: 'arrow', from: 'repo', to: 'build', bend: .35 },
    { id: 'a2', type: 'arrow', from: 'build', to: 'test' },
    { id: 'a3', type: 'arrow', from: 'test', to: 'ship', glow: true },

    { id: 'times', type: 'chart', kind: 'bar', x: 800, y: 270, w: 640, h: 260, data: [14, 11, 9, 12],
      labels: ['build', 'test', 'scan', 'deploy'], fmt: '{} min', max: 16 },
    { id: 'saved', type: 'text', x: 800, y: 455, text: 'Caching cut the pipeline from 46 to 15 minutes', size: 26, tone: 'fg' },

    { id: 'site', type: 'frame', kind: 'browser', x: 800, y: 330, w: 720, h: 380, title: 'status.app.dev' },
    { id: 'okicon', type: 'icon', name: 'shield-check', x: 800, y: 270, size: 72, tone: 'ok', fx: 'bounce' },
    { id: 'oktext', type: 'text', x: 800, y: 390, text: 'All systems operational', size: 36, fx: 'type', markTone: 'ok' },

    { id: 'errs', type: 'chart', kind: 'line', x: 800, y: 300, w: 760, h: 280, data: [9, 7, 8, 4, 3, 1, .5],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], tone: 'ok', values: true, decimals: 1, fmt: '{}%' },
    { id: 'done', type: 'title', x: 800, y: 650, align: 'middle', kicker: 'Status', text: 'Shipped.', size: 72, fx: 'scramble', tone: 'ok' },
    { id: 'pop', type: 'particles', x: 800, y: 650, w: 700, h: 320, n: 48, mode: 'burst', tone: 'ok', size: 3 },
  ],
  steps: [
    { title: 'A release in six steps',
      say: 'This is how one commit becomes a live release: push, build, test, deploy, and check that it worked.',
      do: [{ show: 'dust', dur: 1.2 }, { show: 'hero', with: true }] },

    { title: 'Push',
      say: 'It starts in the terminal. **git push** sends the commit to the shared repository.',
      do: [{ hide: 'hero' }, { show: 'term' }, { set: 'term', typed: 1, dur: 2.6, ease: 'linear' },
           { show: 'repo', fx: 'zoom' }, { show: 'push' }, { flow: 'push' }] },

    { title: 'The pipeline',
      say: 'The repository starts a pipeline: **build** the package, **test** it, then **deploy** it.',
      do: [{ hide: ['term', 'push'] }, { show: ['build', 'test', 'ship'], stagger: .18 },
           { show: ['a1', 'a2', 'a3'], stagger: .15 }, { flow: ['a1', 'a2', 'a3'] }, { pulse: 'ship' }] },

    { title: 'Faster with a cache',
      say: 'Each stage used to take minutes. Caching dependencies made every bar shorter.',
      do: [{ hide: ['repo', 'a1'] }, { show: 'times' }, { set: 'times', data: [6, 4, 3, 2], dur: 1.4, ease: 'elastic', at: 2 },
           { show: 'saved', fx: 'words', with: true }, { set: 'saved', mark: 1, dur: .8 }] },

    { title: 'Check the release',
      say: 'After deploy, the status page should say everything is healthy.',
      do: [{ hide: ['times', 'saved'] }, { show: 'site' }, { show: 'okicon' }, { show: 'oktext' }, { set: 'oktext', mark: 1 }] },

    { title: 'Shipped',
      say: 'Errors dropped all week after the release. Shipped.',
      do: [{ hide: ['site', 'okicon', 'oktext', 'build', 'test', 'ship', 'a2', 'a3'] }, { show: 'errs' },
           { show: 'done' }, { show: 'pop', with: true, dur: 1.4 }] },
  ],
});
