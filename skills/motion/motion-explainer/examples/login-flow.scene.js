// Rich-visuals example. Prompt: "Explain a login flow. Icon on every box, a terminal mockup for the curl
// call, a latency chart, zoom into the auth service, hud theme."
// Also shows flow hand-offs: the packet passes through the gateway and the database instead of vanishing.
const req = ['$ curl -X POST api.example.com/login \\', `    -d '{"email":"ana@example.com","password":"••••••••"}'`];
const res = ['', '{ "token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhbmEi…" }', '$ '];

Motion.scene({
  title: 'How a login works',
  subtitle: 'From one `curl` to a signed token, and why the slow part is slow **on purpose**',
  eyebrow: 'Security',
  theme: 'hud',
  backdrop: 'glow',
  elements: [
    { id: 'dust', type: 'particles', x: 800, y: 450, w: 1600, h: 900, n: 60, mode: 'drift', alpha: .5 },
    { id: 'hero', type: 'title', x: 170, y: 400, kicker: 'Login, step by step', text: 'One password in, one signed token out', size: 76, maxw: 1150 },

    { id: 'term', type: 'frame', kind: 'terminal', x: 420, y: 300, w: 700, h: 240, title: 'zsh  ~/app', size: 16, typed: 0, lines: [...req, ...res] },

    { id: 'gw', type: 'box', x: 420, y: 680, w: 300, h: 120, icon: 'network', label: 'API gateway', sub: 'routes /login' },
    { id: 'auth', type: 'box', x: 900, y: 680, w: 340, h: 150, icon: 'lock', label: 'Auth service', sub: 'checks the password', tone: 'accent', labelMaxZoom: 2 },
    { id: 'db', type: 'box', x: 1360, y: 680, w: 280, h: 120, icon: 'database', label: 'Users DB', sub: 'email → password hash', shape: 'db' },

    // Inside the auth service: tiny on the canvas, readable once the camera zooms in.
    { id: 'rl', type: 'box', x: 790, y: 662, w: 84, h: 64, icon: 'clock', label: 'Rate limit', size: 9, minZoom: 2.2, tone: 'teal' },
    { id: 'bc', type: 'box', x: 900, y: 662, w: 84, h: 64, icon: 'cpu', label: 'bcrypt', size: 9, minZoom: 2.2, tone: 'warn' },
    { id: 'ts', type: 'box', x: 1010, y: 662, w: 84, h: 64, icon: 'key', label: 'Sign JWT', size: 9, minZoom: 2.2, tone: 'ok' },
    { id: 'i1', type: 'arrow', from: 'rl', to: 'bc', width: .8, gap: 3, minZoom: 2.2 },
    { id: 'i2', type: 'arrow', from: 'bc', to: 'ts', width: .8, gap: 3, minZoom: 2.2 },
    { id: 'inote', type: 'text', x: 900, y: 724, text: '5 tries a minute · compare the hash · sign with the private key', size: 7, tone: 'dim', minZoom: 2.2 },

    { id: 'tg', type: 'arrow', from: 'term', to: 'gw', label: 'HTTPS' },
    { id: 'ga', type: 'arrow', from: 'gw', to: 'auth', glow: true },
    { id: 'ad', type: 'arrow', from: 'auth', to: 'db' },

    { id: 'lat', type: 'chart', kind: 'bar', x: 1150, y: 300, w: 600, h: 250, data: [2, 4, 250, 1], labels: ['gateway', 'DB lookup', 'bcrypt', 'sign'], fmt: '{} ms', max: 280 },
    { id: 'slow', type: 'text', x: 1150, y: 470, text: 'bcrypt is slow on purpose: guessing passwords gets slow too', size: 24, markTone: 'warn' },

    { id: 'ok', type: 'icon', name: 'shield-check', x: 650, y: 585, size: 56, tone: 'ok', fx: 'bounce' },
    { id: 'nfast', type: 'note', x: 1180, y: 420, w: 520, tone: 'ok', title: 'Later requests skip the database',
      text: 'The gateway checks the token signature with the public key. No password, no DB call, about a millisecond.' },

    { id: 'end', type: 'title', x: 800, y: 300, align: 'middle', kicker: 'In short', text: 'Check the password once, then trust the signature.', size: 52, maxw: 1200, fx: 'scramble' },
    { id: 'pop', type: 'particles', x: 800, y: 300, w: 900, h: 300, n: 50, mode: 'burst', tone: 'ok', size: 3 },
  ],
  steps: [
    { title: 'One password in, one token out',
      say: 'Logging in trades a password for a **signed token**. Here is every hop, and the one that is slow on purpose.',
      do: [{ show: 'dust', dur: 1.2 }, { show: 'hero', with: true }] },

    { title: 'The request',
      say: 'The app sends the email and password once, over **HTTPS**, to the login endpoint.',
      do: [{ hide: 'hero' }, { show: 'term' }, { set: 'term', typed: .5, dur: 2.4, ease: 'linear' }] },

    { title: 'Through the gateway',
      say: 'The **API gateway** receives it and routes it to the **auth service**. The packet passes through the gateway on its way.',
      do: [{ show: ['gw', 'auth', 'db'], stagger: .15 }, { show: ['tg', 'ga', 'ad'], stagger: .12 },
           { flow: 'tg', label: 'POST /login' }, { flow: 'ga', label: 'email + password' }] },

    { title: 'Inside the auth service',
      say: 'Zoom in: a **rate limit** first, then **bcrypt** compares the password to the stored hash, then the service **signs a token**.',
      do: [{ show: ['rl', 'bc', 'ts', 'i1', 'i2', 'inote'], dur: .1 }, { camera: 'auth', pad: 24 },
           { flow: 'i1', dur: .8 }, { flow: 'i2', dur: .8 }] },

    { title: 'Look up the hash',
      say: 'The auth service never stores passwords, only **hashes**. It fetches the hash for this email from the users database.',
      do: [{ camera: 'canvas' }, { flow: 'ad', label: 'find ana@' }, { flow: 'ad', reverse: true, label: 'hash' }, { pulse: 'auth' }] },

    { title: 'Slow on purpose',
      say: 'Almost all the time goes to **bcrypt**: about a quarter of a second. That cost is deliberate: an attacker guessing passwords pays it on every try.',
      do: [{ focus: ['lat', 'slow', 'auth'] }, { show: 'lat' }, { show: 'slow', fx: 'words' }, { set: 'slow', mark: 1, dur: .8 },
           { pulse: 'bc', tone: 'warn' }, { set: 'auth', tone: 'warn', with: true }] },

    { title: 'A signed token comes back',
      say: 'The password matches, so the service signs a **token** with its private key. It travels back through the gateway to the app.',
      do: [{ unfocus: true }, { hide: ['lat', 'slow'], with: true }, { set: 'auth', tone: 'accent' },
           { flow: 'ga', reverse: true, label: 'JWT', tone: 'ok' }, { flow: 'tg', reverse: true, label: 'JWT', tone: 'ok' },
           { set: 'term', typed: 1, dur: 1.8, ease: 'linear' }] },

    { title: 'Every request after that',
      say: 'From now on the app sends the token. The gateway checks its **signature** with the public key: no password and no database, about a millisecond.',
      do: [{ focus: ['term', 'tg', 'gw', 'ok', 'nfast'] }, { flow: 'tg', label: 'Bearer eyJ…', tone: 'ok' },
           { show: 'ok' }, { set: 'gw', sub: 'signature ✓', tone: 'ok' }, { show: 'nfast' }] },

    { title: 'In short',
      say: 'Check the password once, slowly, then trust the signature.',
      do: [{ unfocus: true }, { hide: ['term', 'tg', 'nfast', 'ok'] }, { camera: { x: 800, y: 560, zoom: 1.1 } },
           { show: 'end' }, { show: 'pop', with: true, dur: 1.4 }] },
  ],
});
