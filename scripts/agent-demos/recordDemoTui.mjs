// A public demo video: the REAL Claude Code TUI, in a terminal, driving JBrowse
// Desktop over MCP — everything visible, with friendly burned-in narration. The
// TUI runs in a tmux session so `tmux send-keys` can type the prompts (Wayland
// blocks synthetic keystrokes to apps, but tmux injects into the pty) and
// `tmux capture-pane` can tell when each turn finishes.
//
//   node scripts/agent-demos/recordDemoTui.mjs <outdir> [takes/<name>.mjs]
//
// A take module is the shape recordDemoMac.mjs consumes — STEPS, and optionally
// SYSTEM(cwd) and SHELL. Without one the BRCA1 steps below are the take.
//
// The side-by-side layout is automated: the take runs on a fresh empty
// workspace, and ydotool presses the same Super+Left / Super+Right a person
// would, so GNOME's own tiling does the arranging. Nothing here positions a
// window itself — Wayland forbids that.
//
// Needs: a GNOME/Wayland session that is CURRENTLY ACTIVE (a locked screen or a
// switched-away VT swallows every injected key silently), `ydotoold` running,
// `pnpm --filter @jbrowse/desktop build` (fresh, or hg38 renders the stale-build
// protein3d error), `claude`/`tmux`/`ffmpeg`/`python3`, no other JBrowse Desktop
// running.
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

// The TUI driving is demoCore's, not this file's own: the startup choosers, the
// readiness markers and the working-spinner pattern all move whenever Claude
// Code restyles its status line, and one copy of them is the only way both
// harnesses stay shot-able. This file kept private copies until 2026-09-09,
// which is why it still matched `❯` — a shell prompt — as readiness and keyed
// turn detection on `esc to interrupt`, which 2.1.263 no longer draws.
import {
  capture as capturePane,
  delay,
  tmux,
  typePrompt as typePromptInto,
  waitTurnDone as waitTurnDoneIn,
  waitTuiReady,
} from './demoCore.mjs'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
)
// a worktree can film against the primary checkout's build rather than its own
const desktopRoot =
  process.env.JBROWSE_DESKTOP_ROOT ??
  path.join(repoRoot, 'products/jbrowse-desktop')
const outDir = process.argv[2] ?? path.join(process.cwd(), 'jbrowse-tui-demo')
fs.mkdirSync(outDir, { recursive: true })
// the agent's own working directory, so a take that writes files does not
// scatter them among the recorder's mp4 and captions
const cwd = path.join(outDir, 'cwd')
fs.mkdirSync(cwd, { recursive: true })
const take = process.argv[3] ? await import(path.resolve(process.argv[3])) : {}

const SESSION = 'jbdemo'
// the window opens at this size and GNOME's tiling then resizes it; the two
// must differ, or the layout check cannot see the tile land
const COLS = 80
const ROWS = 24

// friendly, natural questions a person would ask; the narration below explains
// each in plain language for the viewer
const DEFAULT_STEPS = [
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

const STEPS =
  take.STEPS ??
  (take.TURNS ? take.TURNS.map(prompt => ({ prompt, say: '' })) : DEFAULT_STEPS)
const SHELL = take.SHELL ?? false
const MCP_TOOLS =
  'mcp__jbrowse__run_javascript,mcp__jbrowse__open,mcp__jbrowse__docs,mcp__jbrowse__screenshot'

const capture = () => capturePane(SESSION)

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  cleanup()
  process.exit(1)
}

// ------------------------------------------------------------ GNOME layout
// evdev codes; ydotool speaks them, not keysyms
const KEY = { super: 125, left: 105, right: 106, ctrl: 29, alt: 56, down: 108 }
const TILING_ASSISTANT = 'org.gnome.shell.extensions.tiling-assistant'
const ydotoolSocket = process.env.YDOTOOL_SOCKET ?? '/tmp/.ydotool_socket'

// press a chord and release it in reverse, the way a hand does
function press(...codes) {
  execFileSync(
    'ydotool',
    [
      'key',
      ...codes.map(c => `${c}:1`),
      ...codes.toReversed().map(c => `${c}:0`),
    ],
    { env: { ...process.env, YDOTOOL_SOCKET: ydotoolSocket } },
  )
}

const gsettings = (...args) =>
  execFileSync('gsettings', args, { encoding: 'utf8' }).trim()

// GNOME retires an emptied workspace on its own, so the take needs no undo: it
// walks to the last one, which dynamic workspaces keep empty, and the windows
// it launches there are the only ones in frame and the only ones focus can land
// on
function emptyWorkspace() {
  for (let i = 0; i < 6; i++) {
    press(KEY.ctrl, KEY.alt, KEY.down)
  }
}

// ------------------------------------------------------------ preconditions
if (process.env.XDG_SESSION_TYPE !== 'wayland') {
  console.error(`warning: session type is ${process.env.XDG_SESSION_TYPE}`)
}
if (!fs.existsSync(path.join(desktopRoot, 'build/index.html'))) {
  fail('no desktop build — run `pnpm --filter @jbrowse/desktop build`')
}
for (const bin of [
  'claude',
  'tmux',
  'ffmpeg',
  'python3',
  'gnome-terminal',
  'ydotool',
  'gsettings',
  'loginctl',
]) {
  if (spawnSync('which', [bin], { stdio: 'ignore' }).status !== 0) {
    fail(`${bin} is not on PATH`)
  }
}
if (!fs.existsSync(ydotoolSocket)) {
  fail(
    `no ydotoold socket at ${ydotoolSocket} — start it with\n` +
      `  sudo ydotoold --socket-path=${ydotoolSocket} --socket-own=$(id -u):$(id -g)`,
  )
}
// an inactive session — a locked screen, or another VT in front — takes every
// injected key and drops it without an error anywhere, and the take then films
// two untiled windows
{
  const loginctl = (...args) =>
    spawnSync('loginctl', args, { encoding: 'utf8' }).stdout.trim()
  const active = loginctl(
    'show-seat',
    'seat0',
    '-p',
    'ActiveSession',
    '--value',
  )
  const owner = loginctl('show-session', active, '-p', 'Name', '--value')
  if (owner !== os.userInfo().username) {
    fail(
      `seat0's active session belongs to "${owner || 'nobody'}", not you — ` +
        'unlock the screen and switch back to it, or every injected keystroke ' +
        'is silently dropped',
    )
  }
}
// Ubuntu hands Super+Left/Right to the Tiling Assistant extension and leaves
// mutter's own toggle-tiled-* unbound; either one tiles, neither is fatal to
// find missing until the layout check below
const tileKeys = [
  ...(() => {
    try {
      return [
        gsettings('get', TILING_ASSISTANT, 'tile-left-half'),
        gsettings('get', TILING_ASSISTANT, 'tile-right-half'),
      ]
    } catch {
      return []
    }
  })(),
  gsettings('get', 'org.gnome.mutter.keybindings', 'toggle-tiled-left'),
  gsettings('get', 'org.gnome.mutter.keybindings', 'toggle-tiled-right'),
]
if (!tileKeys.some(v => v.includes('<Super>Left'))) {
  fail(
    'nothing binds Super+Left to tiling — bind it with `gsettings set ' +
      'org.gnome.mutter.keybindings toggle-tiled-left "[\'<Super>Left\']"` ' +
      '(and -right), or enable the Tiling Assistant extension',
  )
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

// the app's bridge speaks newline-delimited {id, tool, args} → {id, result} on
// the same socket the MCP server relays to, so the harness can ask the running
// app a question directly — here, whether it is up and how wide its window is
function bridgeCall(tool, args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const s = net.createConnection(socketPath, () => {
      s.write(`${JSON.stringify({ id: 0, tool, args })}\n`)
    })
    const timer = setTimeout(() => {
      s.destroy()
      reject(new Error(`the app did not answer "${tool}" in time`))
    }, timeoutMs)
    const done = (err, value) => {
      clearTimeout(timer)
      s.destroy()
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      } else {
        resolve(value)
      }
    }
    s.on('data', d => {
      buf += d
      const nl = buf.indexOf('\n')
      if (nl < 0) {
        return
      }
      const msg = JSON.parse(buf.slice(0, nl))
      done(msg.error ? new Error(msg.error) : undefined, msg.result)
    })
    s.on('error', e => {
      done(e)
    })
  })
}

// `app_version` is the one call the bridge answers before a session is open —
// every other tool wants the session the take's own first turn creates. The
// app makes its window before it starts the bridge, so an answer here means
// there is a window to tile.
async function waitForApp(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      return await bridgeCall('app_version', {})
    } catch (e) {
      if (Date.now() > deadline) {
        fail(`JBrowse never became reachable: ${e.message}`)
      }
      await delay(1000)
    }
  }
}

// `window.innerWidth` needs a session, so the JBrowse half can only be measured
// once the take's first turn has opened one — late, but it is the difference
// between a bad layout that ships and one that fails the take
async function checkTiled() {
  const geom = (
    await bridgeCall('run_javascript', {
      code: 'return { w: window.innerWidth, screen: window.screen.width }',
    })
  )?.value
  if (!geom || geom.w > geom.screen * 0.6) {
    fail(
      `JBrowse is not tiled: its window is ${geom?.w}px of a ${geom?.screen}px screen`,
    )
  }
}

// ------------------------------------------------------------ TUI driving
const typePrompt = text => typePromptInto(SESSION, text)

async function waitTurnDone(before) {
  if (!(await waitTurnDoneIn(SESSION, before))) {
    console.error('  (turn did not settle before timeout; continuing)')
  }
}

// ------------------------------------------------------------ captions (ASS)
function assTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = (sec % 60).toFixed(2).padStart(5, '0')
  return `${h}:${String(m).padStart(2, '0')}:${s}`
}
function wrap(text, width = 62) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    if (`${line} ${w}`.trim().length > width) {
      lines.push(line.trim())
      line = w
    } else {
      line += ` ${w}`
    }
  }
  if (line.trim()) {
    lines.push(line.trim())
  }
  return lines.join('\\N')
}
function writeCaptions(file, cues) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narr, DejaVu Sans, 36, &H00FFFFFF, &H20000000, &H00000000, 1, 3, 8, 0, 2, 80, 80, 24, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const lines = cues.map(
    c =>
      `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Narr,,0,0,0,,${wrap(c.text)}`,
  )
  fs.writeFileSync(file, `${header + lines.join('\n')}\n`)
}

// ------------------------------------------------------------ main
let renderer
let app
let sessionTerm
let recorder
let tilingPopup
function cleanup() {
  try {
    fs.writeFileSync(path.join(outDir, 'stop.flag'), '')
  } catch {}
  try {
    tmux('kill-session', '-t', SESSION)
  } catch {}
  if (tilingPopup !== undefined) {
    try {
      gsettings('set', TILING_ASSISTANT, 'enable-tiling-popup', tilingPopup)
    } catch {}
    tilingPopup = undefined
  }
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

  // Tiling Assistant offers the other half to a second window the moment the
  // first one tiles, and that chooser covers the screen and swallows the next
  // keystroke
  try {
    tilingPopup = gsettings('get', TILING_ASSISTANT, 'enable-tiling-popup')
    gsettings('set', TILING_ASSISTANT, 'enable-tiling-popup', 'false')
  } catch {
    tilingPopup = undefined
  }
  console.log('moving to an empty workspace…')
  emptyWorkspace()
  await delay(1500)

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
  await waitForApp(90000)
  await delay(4000)
  // the only window on the workspace, so it holds focus and the tiling key
  // reaches it
  press(KEY.super, KEY.right)
  await delay(1500)

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
  const system = take.SYSTEM
    ? take.SYSTEM(cwd)
    : [
        'You are demonstrating JBrowse Desktop live in a short video for people learning what this AI can do.',
        'When asked to open the human genome, use the open tool with exactly this URL: https://jbrowse.org/ucsc/hg38/config.json (the built-in hg38).',
        'Be direct and friendly: accomplish each request with as few tool calls as possible, then reply in one warm, plain-English sentence a non-expert understands.',
        'Do NOT inspect, modify, or remove plugins or configuration.',
        'Leave nothing open over the view: hide the track selector once the track is on, so the genome fills the window.',
        'After each change call jb.waitReady and confirm the gene track actually drew before answering.',
      ].join(' ')

  // real Claude Code TUI inside tmux
  console.log('starting the real Claude Code session…')
  // the session runs in the take's own directory, so the path on screen is not
  // somebody's checkout
  tmux(
    'new-session',
    '-d',
    '-s',
    SESSION,
    '-c',
    cwd,
    '-x',
    String(COLS),
    '-y',
    String(ROWS),
  )
  // without this the TUI opens on a warning about it, which is the first thing
  // the video would show
  tmux('set-option', '-t', SESSION, 'focus-events', 'on')
  // Sonnet, not the session default (Fable) — a lighter model is the honest
  // thing to show in a public demo, and plenty for driving the app
  // The invocation goes in a script rather than down the wire: a take's system
  // prompt runs past a thousand characters, and zsh's line editor never submits
  // a send-keys line that long — it redraws it, echoes it truncated and sits
  // there. It also keeps the command on camera short enough to read.
  const startScript = path.join(cwd, 'start-session.sh')
  fs.writeFileSync(
    startScript,
    `#!/bin/sh\nexec claude --model sonnet --verbose \\\n  --mcp-config ${JSON.stringify(mcpConfig)} --strict-mcp-config \\\n  --allowedTools '${MCP_TOOLS}${SHELL ? ',Bash,Read,Write,Edit,Glob,Grep' : ''}' \\\n  --append-system-prompt ${JSON.stringify(system)}\n`,
  )
  fs.chmodSync(startScript, 0o755)
  tmux('send-keys', '-t', SESSION, './start-session.sh', 'Enter')
  // demoCore answers the startup choosers on the way — the take's cwd is a
  // fresh directory every run, so the folder-trust one always shows up, and
  // whatever is typed while it is up goes into it rather than into Claude
  if (!(await waitTuiReady(SESSION))) {
    const pane = capture()
    fs.writeFileSync(path.join(outDir, 'tui-stuck.txt'), pane)
    console.error(pane.split('\n').slice(-25).join('\n'))
    fail(
      `the Claude Code TUI never reached its prompt — pane saved to ${path.join(outDir, 'tui-stuck.txt')}`,
    )
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
  await delay(3000)
  // tmux follows its attached client, so the pane's width is the window's, and
  // a width that does not move is the tell that the key went somewhere else
  const clientWidth = () =>
    Number(tmux('display', '-p', '-t', SESSION, '#{client_width}'))
  const untiled = clientWidth()
  press(KEY.super, KEY.left)
  await delay(1500)
  const tiled = clientWidth()
  if (tiled === untiled) {
    fail(
      `the terminal did not tile — it is still ${untiled} columns wide. The ` +
        'tiling key went to another window, or to nothing.',
    )
  }
  console.log(`tiled: the terminal is ${tiled} columns wide`)
  // GNOME records the cursor, and it would otherwise sit wherever it was left
  execFileSync('ydotool', ['mousemove', '-a', '-x', '1500', '-y', '4'], {
    env: { ...process.env, YDOTOOL_SOCKET: ydotoolSocket },
  })

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

  let checked = false
  for (const step of STEPS) {
    const start = (Date.now() - t0) / 1000
    console.log(`\n❯ ${step.prompt}`)
    const before = capture()
    await typePrompt(step.prompt)
    await waitTurnDone(before)
    if (!checked) {
      await checkTiled()
      checked = true
    }
    const end = (Date.now() - t0) / 1000
    cues.push({ start: start + 0.3, end: end + 1.5, text: step.say })
    await delay(2500)
  }
  await delay(3000)
  // the last answer lands as its cue expires; hold that one to the end
  cues.at(-1).end = (Date.now() - t0) / 1000

  console.log('stopping recording…')
  fs.writeFileSync(stopFlag, '')
  await new Promise(resolve => recorder.on('exit', resolve))
  await delay(800)

  const raw = path.join(outDir, 'demo.mp4')
  if (!fs.existsSync(raw)) {
    fail(`no recording produced at ${raw}`)
  }
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
