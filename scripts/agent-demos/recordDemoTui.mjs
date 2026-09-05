// A public demo video: the REAL Claude Code TUI, in a terminal, driving JBrowse
// Desktop over MCP — everything visible, with friendly burned-in narration. The
// TUI runs in a tmux session so `tmux send-keys` can type the prompts (Wayland
// blocks synthetic keystrokes to apps, but tmux injects into the pty) and
// `tmux capture-pane` can tell when each turn finishes.
//
//   node scripts/agent-demos/recordDemoTui.mjs <outdir>
//
// WORK IN PROGRESS — the automated side-by-side LAYOUT is not solved. It opens
// JBrowse and the terminal but cannot tile them on Wayland yet; the arrange step
// below still waits/hopes. The lead is ydotool triggering GNOME native tiling —
// see agent-docs/handoffs/agent-demo-video-linux.md. Everything else (real TUI
// on Sonnet + verbose, tmux driving, turn detection, built-in hg38 rendering on
// a fresh build, burned-in captions) works.
//
// Needs: a GNOME/Wayland session, `pnpm --filter @jbrowse/desktop build` (fresh,
// or hg38 renders the stale-build protein3d error), `claude`/`tmux`/`ffmpeg`/
// `python3`, no other JBrowse Desktop running.
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
)
const desktopRoot = path.join(repoRoot, 'products/jbrowse-desktop')
const outDir = process.argv[2] ?? path.join(process.cwd(), 'jbrowse-tui-demo')
fs.mkdirSync(outDir, { recursive: true })

const SESSION = 'jbdemo'
const COLS = 118
const ROWS = 50

// friendly, natural questions a person would ask; the narration below explains
// each in plain language for the viewer
const STEPS = [
  {
    prompt: 'Open the human genome and take me to the BRCA1 gene.',
    say: 'Asked in plain English, Claude opens the human genome (hg38) and navigates to the BRCA1 gene.',
  },
  {
    prompt: 'Zoom in so I can clearly see the BRCA1 gene model.',
    say: 'Claude zooms the view until the gene model — its exons and introns — is clearly drawn.',
  },
  {
    prompt: 'How many exons does the BRCA1 transcript have in view?',
    say: 'Claude reads the feature data directly and answers from the real track, not a guess.',
  },
]

const delay = ms => new Promise(r => setTimeout(r, ms))
const tmux = (...args) => execFileSync('tmux', args, { encoding: 'utf8' })
const capture = () => {
  try {
    return tmux('capture-pane', '-p', '-t', SESSION)
  } catch {
    return ''
  }
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  cleanup()
  process.exit(1)
}

// ------------------------------------------------------------ preconditions
if (process.env.XDG_SESSION_TYPE !== 'wayland') {
  console.error(`warning: session type is ${process.env.XDG_SESSION_TYPE}`)
}
if (!fs.existsSync(path.join(desktopRoot, 'build/index.html'))) {
  fail('no desktop build — run `pnpm --filter @jbrowse/desktop build`')
}
for (const bin of ['claude', 'tmux', 'ffmpeg', 'python3', 'gnome-terminal']) {
  if (spawnSync('which', [bin], { stdio: 'ignore' }).status !== 0) {
    fail(`${bin} is not on PATH`)
  }
}
const socketPath = path.join(
  os.tmpdir(),
  `jbrowse-desktop-mcp-${os.userInfo().username.replaceAll(/[^\w.-]+/g, '_')}`,
  'mcp.sock',
)
if (fs.existsSync(socketPath)) {
  fail(
    `a JBrowse bridge socket already exists at ${socketPath} — close JBrowse`,
  )
}

// ------------------------------------------------------------ http: build + config
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}
function serve() {
  const buildDir = path.join(desktopRoot, 'build')
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const file = path.join(buildDir, rel)
    if (file.startsWith(buildDir) && fs.existsSync(file)) {
      res.setHeader(
        'content-type',
        MIME[path.extname(file)] ?? 'application/octet-stream',
      )
      fs.createReadStream(file).pipe(res)
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  return new Promise(resolve => {
    server.listen(0, () => {
      resolve({ port: server.address().port, close: () => server.close() })
    })
  })
}

async function waitForBridge(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const up = await new Promise(resolve => {
      const s = net.createConnection(socketPath, () => {
        s.destroy()
        resolve(true)
      })
      s.on('error', () => {
        resolve(false)
      })
    })
    if (up) return
    if (Date.now() > deadline) fail('JBrowse bridge never came up')
    await delay(1000)
  }
}

// ------------------------------------------------------------ TUI driving
// type a prompt one character at a time so the recording shows real typing
async function typePrompt(text) {
  for (const ch of text) {
    tmux('send-keys', '-t', SESSION, '-l', ch)
    await delay(28)
  }
  await delay(400)
  tmux('send-keys', '-t', SESSION, 'Enter')
}

// a turn is done when the pane has changed from before the prompt AND then gone
// stable with no "esc to interrupt" — the previous turn's "· done" lingers, so
// markers alone give a false positive
async function waitTurnDone(before, maxMs = 150000) {
  const deadline = Date.now() + maxMs
  let started = false
  let stablePane = ''
  let stableCount = 0
  while (Date.now() < deadline) {
    await delay(1500)
    const pane = capture()
    const working = /esc to interrupt/i.test(pane)
    if (!started && (working || pane !== before)) started = true
    if (started && !working) {
      if (pane === stablePane) {
        stableCount++
        if (stableCount >= 2) return
      } else {
        stablePane = pane
        stableCount = 0
      }
    } else {
      stableCount = 0
    }
  }
  console.error('  (turn did not settle before timeout; continuing)')
}

// ------------------------------------------------------------ captions (ASS)
function assTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = (sec % 60).toFixed(2).padStart(5, '0')
  return `${h}:${String(m).padStart(2, '0')}:${s}`
}
function wrap(text, width = 74) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim())
      line = w
    } else {
      line += ' ' + w
    }
  }
  if (line.trim()) lines.push(line.trim())
  return lines.join('\\N')
}
function writeCaptions(file, cues) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narr, DejaVu Sans, 40, &H00FFFFFF, &H00000000, &H96000000, 1, 3, 0, 0, 2, 60, 60, 60, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const lines = cues.map(
    c =>
      `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Narr,,0,0,0,,${wrap(c.text)}`,
  )
  fs.writeFileSync(file, header + lines.join('\n') + '\n')
}

// ------------------------------------------------------------ main
let renderer
let app
let sessionTerm
let recorder
function cleanup() {
  try {
    fs.writeFileSync(path.join(outDir, 'stop.flag'), '')
  } catch {}
  try {
    tmux('kill-session', '-t', SESSION)
  } catch {}
  sessionTerm?.kill()
  recorder?.kill()
  renderer?.close()
  app?.kill()
}
process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})

try {
  const userDataDir = path.join(outDir, 'userdata')
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(
    path.join(userDataDir, 'window-state.json'),
    JSON.stringify({
      width: 1180,
      height: 1040,
      x: 720,
      y: 0,
      isMaximized: false,
      isFullScreen: false,
    }),
  )

  renderer = await serve()
  const require = (await import('node:module')).createRequire(
    path.join(desktopRoot, 'package.json'),
  )
  console.log('launching JBrowse Desktop…')
  app = spawn(
    require('electron'),
    ['.', '--no-sandbox', `--user-data-dir=${userDataDir}`],
    {
      cwd: desktopRoot,
      stdio: 'ignore',
      env: {
        ...process.env,
        DEV_SERVER_URL: `http://localhost:${renderer.port}`,
      },
    },
  )
  await waitForBridge(90000)

  const mcpConfig = path.join(outDir, 'mcp-config.json')
  fs.writeFileSync(
    mcpConfig,
    JSON.stringify({
      mcpServers: {
        jbrowse: {
          command: 'node',
          args: [path.join(desktopRoot, 'build/mcpServer.js')],
        },
      },
    }),
  )
  const system = [
    'You are demonstrating JBrowse Desktop live in a short video for people learning what this AI can do.',
    'When asked to open the human genome, use the open tool with exactly this URL: https://jbrowse.org/ucsc/hg38/config.json (the built-in hg38).',
    'Be direct and friendly: accomplish each request with as few tool calls as possible, then reply in one warm, plain-English sentence a non-expert understands.',
    'Do NOT inspect, modify, or remove plugins or configuration.',
    'After each change call jb.waitReady and confirm the gene track actually drew before answering.',
  ].join(' ')

  // real Claude Code TUI inside tmux
  console.log('starting the real Claude Code session…')
  tmux(
    'new-session',
    '-d',
    '-s',
    SESSION,
    '-x',
    String(COLS),
    '-y',
    String(ROWS),
  )
  // Sonnet, not the session default (Fable) — a lighter model is the honest
  // thing to show in a public demo, and plenty for driving the app
  const claudeCmd =
    `claude --model sonnet --verbose --mcp-config ${JSON.stringify(mcpConfig)} --strict-mcp-config ` +
    `--allowedTools 'mcp__jbrowse__run_javascript,mcp__jbrowse__open,mcp__jbrowse__docs,mcp__jbrowse__screenshot' ` +
    `--append-system-prompt ${JSON.stringify(system)}`
  tmux('send-keys', '-t', SESSION, claudeCmd, 'Enter')
  // wait for the TUI to be ready (idle prompt)
  for (let i = 0; i < 40; i++) {
    await delay(1000)
    if (/bypass permissions|\S+\s*\/effort|❯/.test(capture())) break
  }
  await delay(2000)

  // visible terminal showing the real session
  sessionTerm = spawn(
    'gnome-terminal',
    [
      `--geometry=${COLS}x${ROWS}`,
      '--title=Claude Code',
      '--',
      'tmux',
      'attach',
      '-t',
      SESSION,
    ],
    { stdio: 'ignore' },
  )
  await delay(2500)

  // arrange pause: Wayland won't tile for us
  const ARRANGE = 16
  for (let s = ARRANGE; s > 0; s--) {
    tmux(
      'send-keys',
      '-t',
      SESSION,
      '-l',
      s === ARRANGE
        ? `# Tile now: click me + Super+Left, click JBrowse + Super+Right. Recording in ${s}s… `
        : '',
    )
    process.stdout.write(`\r  arrange windows — recording in ${s}s   `)
    await delay(1000)
  }
  // clear that helper line so it is not typed as a prompt
  tmux('send-keys', '-t', SESSION, 'C-u')
  console.log('\nstarting recording…')

  const stopFlag = path.join(outDir, 'stop.flag')
  fs.rmSync(stopFlag, { force: true })
  recorder = spawn(
    'python3',
    [
      path.join(repoRoot, 'scripts/agent-demos/recorder.py'),
      path.join(outDir, 'demo'),
      stopFlag,
      '600',
    ],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  )
  await delay(2500)
  const t0 = Date.now()
  const cues = [
    {
      start: 0,
      end: 4.5,
      text: 'A real Claude Code session driving JBrowse Desktop — every command below is Claude’s own.',
    },
  ]

  for (const step of STEPS) {
    const start = (Date.now() - t0) / 1000
    console.log(`\n❯ ${step.prompt}`)
    const before = capture()
    await typePrompt(step.prompt)
    await waitTurnDone(before)
    const end = (Date.now() - t0) / 1000
    cues.push({ start: start + 0.3, end: end + 1.5, text: step.say })
    await delay(2500)
  }
  await delay(3000)

  console.log('stopping recording…')
  fs.writeFileSync(stopFlag, '')
  await new Promise(resolve => recorder.on('exit', resolve))
  await delay(800)

  const raw = path.join(outDir, 'demo.mp4')
  if (!fs.existsSync(raw)) fail(`no recording produced at ${raw}`)
  const assFile = path.join(outDir, 'captions.ass')
  writeCaptions(assFile, cues)
  const final = path.join(outDir, 'demo-captioned.mp4')
  console.log('burning in narration…')
  spawnSync(
    'ffmpeg',
    ['-y', '-i', raw, '-vf', `ass=${assFile}`, '-c:a', 'copy', final],
    { stdio: 'inherit' },
  )
  spawnSync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      '2',
      '-i',
      final,
      '-frames:v',
      '1',
      path.join(outDir, 'poster.png'),
    ],
    { stdio: 'ignore' },
  )
  console.log(`\n✓ ${final}`)
} finally {
  cleanup()
}
