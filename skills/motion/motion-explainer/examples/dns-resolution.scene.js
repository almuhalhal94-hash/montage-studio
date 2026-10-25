// Generated end to end by the skill from one prompt ("How DNS resolution works"), unedited.
// How a name becomes an IP: browser → stub → recursive resolver → root → .com → authoritative,
// then TTL caching on the way back. Records, TTLs and latencies come from one
// `dig +trace example.com` run on 2026-10-07 (root 84 ms, .com 66 ms, auth 10 ms, router 5 ms).
const cached = ['c1', 'c1t', 'c2', 'c2t', 'c3', 'c3t'];
const ip = '104.20.23.154';

Motion.scene({
  title: 'How DNS turns example.com into an IP',
  subtitle: 'Stub resolver, recursive resolver, root, `.com`, authoritative, and the **TTL** caches that make it fast',
  eyebrow: 'Networking',
  elements: [
    // Your machine
    { id: 'pc', type: 'zone', x: 220, y: 400, w: 320, h: 560, label: 'Your computer', tone: 'teal' },
    { id: 'browser', type: 'box', x: 220, y: 250, w: 260, h: 110, label: 'Browser', sub: 'own DNS cache', icon: 'globe' },
    { id: 'stub', type: 'box', x: 220, y: 540, w: 260, h: 110, label: 'Stub resolver', sub: 'hosts file · OS cache', icon: 'laptop' },
    { id: 'b2s', type: 'arrow', from: 'browser', to: 'stub', label: 'getaddrinfo()' },

    // Lookup clock
    { id: 'ms', type: 'text', x: 690, y: 115, value: 0, fmt: '{} ms', size: 48, weight: 700 },
    { id: 'msCap', type: 'text', x: 690, y: 165, text: 'lookup time, one real trace', size: 18, tone: 'dim' },

    // Recursive resolver and its cache
    { id: 'resolver', type: 'box', x: 690, y: 330, w: 340, h: 120, label: 'Recursive resolver', sub: 'ISP · router upstream · 1.1.1.1', icon: 'server' },
    { id: 's2r', type: 'arrow', from: 'stub', to: 'resolver', label: 'UDP 53' },
    { id: 'cache', type: 'zone', x: 690, y: 640, w: 520, h: 230, label: 'Resolver cache', tone: 'info' },
    { id: 'c1', type: 'text', x: 450, y: 590, text: '.com → a–m.gtld-servers.net', size: 18, mono: true, align: 'start' },
    { id: 'c1t', type: 'text', x: 930, y: 590, text: 'TTL 2 d', size: 18, mono: true, align: 'end', tone: 'dim' },
    { id: 'c2', type: 'text', x: 450, y: 650, text: 'example.com → *.ns.cloudflare.com', size: 18, mono: true, align: 'start' },
    { id: 'c2t', type: 'text', x: 930, y: 650, text: 'TTL 2 d', size: 18, mono: true, align: 'end', tone: 'dim' },
    { id: 'c3', type: 'text', x: 450, y: 710, text: 'example.com → ' + ip, size: 18, mono: true, align: 'start', tone: 'ok' },
    { id: 'c3t', type: 'text', x: 930, y: 710, value: 300, fmt: 'TTL {} s', size: 18, mono: true, align: 'end', tone: 'ok' },

    // The hierarchy
    { id: 'tree', type: 'zone', x: 1260, y: 400, w: 440, h: 620, label: 'DNS hierarchy' },
    { id: 'root', type: 'box', x: 1260, y: 200, w: 380, h: 110, label: 'Root servers', sub: 'a–m.root-servers.net · anycast', icon: 'network' },
    { id: 'tld', type: 'box', x: 1260, y: 400, w: 380, h: 110, label: '.com TLD servers', sub: 'a–m.gtld-servers.net · Verisign', icon: 'layers' },
    { id: 'auth', type: 'box', x: 1260, y: 600, w: 380, h: 110, label: 'Authoritative', sub: 'example.com: *.ns.cloudflare.com', icon: 'database' },
    { id: 'q1', type: 'arrow', from: 'resolver', to: 'root', fromOffset: [170, -40] },
    { id: 'q2', type: 'arrow', from: 'resolver', to: 'tld', fromOffset: [170, 0] },
    { id: 'q3', type: 'arrow', from: 'resolver', to: 'auth', fromOffset: [170, 40] },

    { id: 'nRoot', type: 'note', x: 1260, y: 790, w: 440, tone: 'warn', title: 'Root servers don\'t know IPs',
      text: 'They only know who runs each top-level domain, and that answer is cached for 2 days.' },
    { id: 'nProp', type: 'note', x: 1260, y: 790, w: 440, tone: 'warn', title: '"Propagation" is caches expiring',
      text: 'Nothing is pushed out. Each resolver keeps the old IP until its copy\'s TTL runs out.' },
  ],
  steps: [
    { title: 'You type example.com', say: 'The browser needs an IP address before it can open a connection. First it checks its own small DNS cache. Nothing there yet.',
      do: [{ camera: 'pc', pad: 40, dur: .1 }, { show: 'pc' }, { show: 'browser' }, { set: 'browser', sub: 'own cache: miss', tone: 'warn' }, { pulse: 'browser', tone: 'warn', with: true }] },
    { title: 'The stub resolver sends one query', say: 'The browser hands the name to the **stub resolver**, usually part of the OS. It checks the hosts file and OS cache, misses, and sends one query to a recursive resolver over UDP port 53.',
      do: [{ show: ['stub', 'b2s'] }, { flow: 'b2s', label: 'example.com?' }, { set: 'stub', sub: 'hosts ✗ · OS cache ✗', tone: 'warn' },
           { camera: ['pc', 'resolver'], pad: 100 }, { show: ['resolver', 's2r'], with: true }, { flow: 's2r', label: 'example.com A?' }] },
    { title: 'The recursive resolver does the legwork', say: 'The **recursive resolver** (your ISP, a router upstream, or a public one like 1.1.1.1) checks its cache. Empty. So it walks the hierarchy itself, starting from root addresses built into it.',
      do: [{ camera: 'canvas' }, { show: 'cache' }, { pulse: 'cache', tone: 'warn' }, { set: 'resolver', sub: 'cache: miss · walking the tree', tone: 'accent' },
           { show: ['ms', 'msCap'] }, { show: 'tree' }] },
    { title: 'Root: "ask .com"', say: 'The root server does not know example.com. It answers with a **referral**: the names and addresses of the `.com` servers. Root servers never hand out website IPs.',
      do: [{ show: ['root', 'q1'] }, { flow: 'q1', label: 'example.com?' }, { flow: 'q1', reverse: true, label: 'referral: .com servers', tone: 'accent' },
           { set: 'ms', value: 84, with: true }, { show: 'nRoot' }] },
    { title: '.com: "ask Cloudflare"', say: 'The `.com` servers, run by Verisign, don\'t know the IP either. They refer the resolver to the nameservers example.com\'s owner picked: Cloudflare\'s.',
      do: [{ hide: 'nRoot' }, { show: ['tld', 'q2'] }, { flow: 'q2', label: 'example.com?' }, { flow: 'q2', reverse: true, label: 'referral: cloudflare NS', tone: 'accent' },
           { set: 'ms', value: 150, with: true }] },
    { title: 'Authoritative: the answer', say: 'The **authoritative** nameserver holds the real record. It returns the A record, the IP, plus a **TTL** of 300 seconds: how long anyone may cache it.',
      do: [{ show: ['auth', 'q3'] }, { flow: 'q3', label: 'example.com?' }, { flow: 'q3', reverse: true, label: 'A ' + ip + ' · TTL 300', tone: 'ok' },
           { set: 'auth', tone: 'ok', with: true }, { set: 'ms', value: 160, with: true }] },
    { title: 'Everyone caches on the way back', say: 'The resolver stores each answer for its TTL: both referrals for 2 days, the A record for 5 minutes. It returns the IP; the OS and browser cache it too. Now the browser connects.',
      do: [{ show: cached, fx: 'left', stagger: .15 }, { set: ['resolver', 'auth'], tone: 'plain' }, { set: 'resolver', sub: 'cache: 3 answers saved', with: true },
           { flow: 's2r', reverse: true, label: ip, tone: 'ok' }, { set: 'stub', sub: 'OS cache: example.com ✓', tone: 'ok' },
           { flow: 'b2s', reverse: true, label: ip, tone: 'ok' }, { set: 'browser', sub: 'connecting to ' + ip, tone: 'ok' },
           { set: 'ms', value: 165, with: true }] },
    { title: 'Next lookup: a cache hit', say: 'Another device on the same resolver asks within 5 minutes. The resolver answers from cache: **one** round trip instead of four, about 5 ms instead of 165. Root and `.com` never hear about it.',
      do: [{ set: ['stub', 'browser', 'resolver'], tone: 'plain' }, { set: 'resolver', sub: 'cache: hit', with: true }, { set: 'stub', sub: 'hosts file · OS cache', with: true },
           { set: 'browser', sub: 'own DNS cache', with: true }, { set: 'ms', value: 0, dur: .3, with: true },
           { focus: ['pc', 'browser', 'stub', 'b2s', 's2r', 'resolver', 'cache', 'ms', 'msCap', ...cached] },
           { flow: 's2r', label: 'example.com A?' }, { highlight: 'c3', tone: 'ok' }, { flow: 's2r', reverse: true, label: ip, tone: 'ok' },
           { set: 'ms', value: 5, with: true }] },
    { title: 'The TTL runs out', say: 'After 300 s the A record expires and is dropped. The next lookup skips root and `.com`, since those referrals are still cached for 2 days, and asks the authoritative server directly.',
      do: [{ unhighlight: '*' }, { unfocus: true, with: true }, { set: 'c3t', value: 0, dur: 2.5, ease: 'linear' },
           { set: ['c3', 'c3t'], tone: 'bad' }, { hide: ['c3', 'c3t'] }, { set: 'c3t', value: 300, dur: .1 }, { set: ['c3', 'c3t'], tone: 'ok', dur: .1 },
           { set: 'ms', value: 0, dur: .3 }, { focus: ['resolver', 'cache', ...cached, 'auth', 'q3', 'ms', 'msCap'] }, { highlight: 'c2', tone: 'accent' }, { set: 'resolver', sub: 'A expired · referral cached', with: true },
           { flow: 'q3', label: 'example.com?' }, { flow: 'q3', reverse: true, label: 'A ' + ip + ' · TTL 300', tone: 'ok' },
           { show: ['c3', 'c3t'], fx: 'left' }, { set: 'ms', value: 15, with: true }] },
    { title: '"DNS propagation" is caches expiring', say: 'Change the A record and resolvers keep serving the old IP until their cached copy expires. Lower the TTL before a migration so the switch takes minutes, not days.',
      do: [{ unhighlight: '*' }, { unfocus: true, with: true }, { set: 'auth', sub: 'A changed → 203.0.113.7', tone: 'warn' }, { pulse: 'auth', tone: 'warn', with: true },
           { set: ['c3', 'c3t'], tone: 'warn' }, { set: 'resolver', sub: 'serves old IP until TTL ends', with: true }, { pulse: 'cache', tone: 'warn', with: true }, { show: 'nProp' }] },
  ],
});
