// Architecture example: one push, from git to a green check on a self-hosted Mac runner.
// Shows zones, flows riding existing arrows, focus, and a semantic zoom into mac-01
// (its label fades out, the minZoom internals fade in).
const hosts = ['mac1', 'mac2', 'mac3'];
const idle = 'idle · labels: self-hosted, macOS';

Motion.scene({
  title: 'How a GitHub Actions job reaches a self-hosted Mac',
  subtitle: 'Push → job → runner → check, and why runners **pull** instead of being pushed to',
  eyebrow: 'System',
  elements: [
    { id: 'dev', type: 'box', x: 170, y: 340, w: 210, h: 110, label: 'Developer', sub: 'git push' },
    { id: 'gh', type: 'zone', x: 640, y: 340, w: 520, h: 500, label: 'GitHub', tone: 'accent' },
    { id: 'repo', type: 'box', x: 640, y: 180, w: 330, h: 100, label: 'Repository', sub: '.github/workflows/*.yml' },
    { id: 'actions', type: 'box', x: 640, y: 360, w: 330, h: 100, label: 'Actions service', sub: 'turns events into jobs' },
    { id: 'queue', type: 'box', shape: 'pill', x: 640, y: 510, w: 300, h: 64, label: 'Job queue', tone: 'warn' },

    { id: 'fleet', type: 'zone', x: 1250, y: 340, w: 520, h: 500, label: 'Self-hosted runners · Mac fleet', tone: 'teal', labelMaxZoom: 2 },
    { id: 'mac1', type: 'box', x: 1250, y: 190, w: 400, h: 110, label: 'mac-01', sub: idle, labelMaxZoom: 2.2 },
    { id: 'mac2', type: 'box', x: 1250, y: 340, w: 400, h: 110, label: 'mac-02', sub: idle },
    { id: 'mac3', type: 'box', x: 1250, y: 490, w: 400, h: 110, label: 'mac-03', sub: idle },

    // mac-01's insides: tiny in canvas units, readable once the camera zooms in.
    { id: 'lis', type: 'box', x: 1150, y: 178, w: 150, h: 46, label: 'Runner.Listener', sub: 'holds the long poll', size: 11, minZoom: 2.8, tone: 'teal' },
    { id: 'wrk', type: 'box', x: 1350, y: 178, w: 150, h: 46, label: 'Runner.Worker', sub: 'one per job', size: 11, minZoom: 2.8, tone: 'accent' },
    { id: 'spawn', type: 'arrow', from: 'lis', to: 'wrk', label: 'starts', labelSize: 7, width: 1, minZoom: 2.8 },
    { id: 'dnote', type: 'text', x: 1250, y: 226, text: 'The Worker runs each step as a child process, then exits.', size: 8, tone: 'dim', minZoom: 2.8 },

    { id: 'push', type: 'arrow', from: 'dev', to: 'repo', label: 'git push' },
    { id: 'trig', type: 'arrow', from: 'repo', to: 'actions', label: 'on: push' },
    { id: 'enq', type: 'arrow', from: 'actions', to: 'queue' },
    { id: 'poll1', type: 'arrow', from: 'mac1', to: 'actions', dashed: true, tone: 'teal' },
    { id: 'poll2', type: 'arrow', from: 'mac2', to: 'actions', dashed: true, tone: 'teal', label: 'long poll', labelAt: .42 },
    { id: 'poll3', type: 'arrow', from: 'mac3', to: 'actions', dashed: true, tone: 'teal' },
    { id: 'fetch', type: 'arrow', from: 'mac1', to: 'repo', dashed: true, label: 'git fetch' },

    { id: 'pull', type: 'note', x: 1250, y: 720, w: 520, tone: 'warn', title: 'Runners pull; GitHub never pushes',
      text: 'Each runner dials out over HTTPS (port 443). The Macs need no inbound firewall rule.' },
  ],
  steps: [
    { title: 'A push lands on GitHub', say: 'You push a commit. The workflow file in `.github/workflows/` says what runs, and on which runners (`runs-on`).',
      do: [{ show: 'dev' }, { show: ['gh', 'repo'] }, { show: 'push' }, { flow: 'push', label: 'commit' }] },
    { title: 'Actions turns the push into a job', say: 'The Actions service matches the push against the workflow triggers and queues the job, tagged with its `runs-on` labels.',
      do: [{ show: ['actions', 'trig'] }, { flow: 'trig' }, { show: ['queue', 'enq'] }, { flow: 'enq', label: 'job' }, { pulse: 'queue' }] },
    { title: 'Runners are already waiting', say: 'Each Mac runs the runner agent, which keeps an **outbound** HTTPS long poll open to GitHub. GitHub never connects in to the Macs.',
      do: [{ show: 'fleet' }, { show: hosts, stagger: .12 }, { show: ['poll1', 'poll2', 'poll3'], stagger: .12 },
           { flow: 'poll1', tone: 'teal' }, { flow: 'poll2', tone: 'teal', with: true }, { flow: 'poll3', tone: 'teal', with: true }, { show: 'pull' }] },
    { title: 'A matching idle runner takes it', say: 'An idle runner whose labels match gets the job, delivered as the reply on its own long poll.',
      do: [{ highlight: 'mac1' }, { flow: 'poll1', reverse: true, label: 'job', tone: 'accent' },
           { set: 'mac1', sub: 'busy · running the job', tone: 'accent' }, { pulse: 'mac1', with: true }] },
    { title: 'Zoom in: inside the runner', say: '`Runner.Listener` holds the connection. For each job it starts a `Runner.Worker` process, which runs the steps and exits when the job ends.',
      do: [{ show: ['lis', 'wrk', 'spawn', 'dnote'], dur: .1 }, { camera: 'mac1', pad: 30, with: true }, { flow: 'spawn', label: 'job', dur: 1 }] },
    { title: 'Checkout pulls the code', say: '`actions/checkout` fetches the repository from GitHub over HTTPS, then the build steps run on the Mac itself.',
      do: [{ camera: 'canvas' }, { show: 'fetch' }, { flow: 'fetch', reverse: true, label: 'code' }] },
    { title: 'Results flow back', say: 'Logs stream back while the steps run. When the job ends, the result appears as a check on the commit and the runner goes back to polling.',
      do: [{ flow: 'poll1', label: 'logs + status' }, { flow: 'trig', reverse: true, label: '✓ checks' },
           { set: 'repo', sub: '✓ checks passed', tone: 'ok', with: true }, { hide: 'fetch' },
           { unhighlight: 'mac1', with: true }, { set: 'mac1', sub: idle, tone: 'plain', with: true }] },
    { title: 'No free runner? The job waits', say: 'If every matching runner is busy or offline, the job waits in the queue (up to 24 h, then it fails). A queue that keeps backing up means too few runners for those labels.',
      do: [{ set: hosts, sub: 'busy', tone: 'warn' }, { focus: ['queue', ...hosts, 'actions', 'enq'], with: true }, { pulse: 'queue', tone: 'warn' }] },
  ],
});
