// Films the real Claude Code TUI driving JBrowse Desktop, side by side, on
// macOS. The Linux sibling is recordDemoTui.mjs; demoCore.mjs is everything
// they share.
//
//   node scripts/agent-demos/recordDemoMac.mjs <outdir> [takes/<name>.mjs]
//
// The terminal is a real Terminal.app window attached to a tmux session, so
// `tmux send-keys` types the prompts and `tmux capture-pane` says when a turn
// ended. Nothing is read off the screen: the layout is checked by asking the
// app its own `window.innerWidth` over the bridge, and the crop is the union of
// the two window frames as the window server reports them.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'

import {
  appViewport,
  capture,
  defaultSocketPath,
  delay,
  serve,
  tmux,
  typePrompt,
  waitForApp,
  waitTuiReady,
  waitTurnDone,
  writeCaptions,
} from './demoCore.mjs'
import { findWindow, osa, placeWindow } from './macTools.mjs'
import { encode, startCamera } from './windowCamera.mjs'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
)
const desktopRoot = path.join(repoRoot, 'products/jbrowse-desktop')
const outDir = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), 'jbrowse-mac-demo'),
)
const SESSION = 'jbmacdemo'
const COLS = 92
const ROWS = 46
const PROFILE = 'Basic'
const MCP_TOOLS =
  'mcp__jbrowse__run_javascript,mcp__jbrowse__open,mcp__jbrowse__docs,mcp__jbrowse__screenshot'
// 11pt renders ~7px per character once the crop is scaled to 1920 — unreadable
const FONT_SIZE = 16

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

// A take module is the same shape the other harnesses use: TURNS, SHELL and
// SYSTEM. STEPS is this harness's own variant, a prompt with the sentence that
// narrates it.
const take = process.argv[3] ? await import(path.resolve(process.argv[3])) : {}
const STEPS =
  take.STEPS ??
  (take.TURNS ? take.TURNS.map(prompt => ({ prompt, say: '' })) : DEFAULT_STEPS)
const SHELL = take.SHELL ?? false

function fail(msg) {
  console.error(`\n${msg}\n`)
  process.exit(1)
}

for (const bin of ['tmux', 'ffmpeg', 'claude']) {
  if (spawnSync('which', [bin]).status !== 0) {
    fail(`${bin} is not on PATH`)
  }
}

// A crashed take leaves the socket file behind, so existence alone is not the
// question — whether something answers on it is
const socketPath = defaultSocketPath()
if (fs.existsSync(socketPath)) {
  const live = await new Promise(resolve => {
    const s = net.createConnection(socketPath, () => {
      s.destroy()
      resolve(true)
    })
    s.on('error', () => {
      resolve(false)
    })
  })
  if (live) {
    fail(`JBrowse is already running (bridge at ${socketPath}) — close it`)
  }
  console.log(`removing a stale bridge socket at ${socketPath}`)
  fs.rmSync(socketPath, { force: true })
}

fs.mkdirSync(outDir, { recursive: true })

const screenSize = () => ({
  width: Number(
    osa(
      'tell application "Finder" to get item 3 of (get bounds of window of desktop)',
    ),
  ),
  height: Number(
    osa(
      'tell application "Finder" to get item 4 of (get bounds of window of desktop)',
    ),
  ),
})

let renderer
let app
let camera
let savedFontSize
let termWindowId
function cleanup() {
  try {
    tmux('kill-session', '-t', SESSION)
  } catch {}
  if (savedFontSize !== undefined) {
    try {
      osa(
        `tell application "Terminal" to set font size of settings set "${PROFILE}" to ${savedFontSize}`,
      )
    } catch {}
    savedFontSize = undefined
  }
  camera?.stop()
  // By id, not by name: the title reverts to the plain shell the moment tmux
  // exits, so a name match here closes nothing and leaves the window behind
  if (termWindowId !== undefined) {
    try {
      osa(`tell application "Terminal" to close (window id ${termWindowId})`)
    } catch {}
    termWindowId = undefined
  }
  app?.kill()
  renderer?.close()
}
process.on('exit', cleanup)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    process.exit(1)
  })
}

const { width: screenPoints, height: screenHeight } = screenSize()
// Finder's desktop bounds are the whole screen, Dock included, and a window
// placed against that bottom edge puts the Dock in frame — which matters less
// now that the camera films windows rather than the screen, but a window under
// the Dock is still one the operator cannot see
const TOP = 40
const DOCK = 120
const winHeight = screenHeight - TOP - DOCK
console.log(
  `screen ${screenPoints}x${screenHeight}pt, windows ${winHeight}pt tall`,
)

const termWidth = Math.round(screenPoints * 0.45)
const jbWidth = screenPoints - termWidth

try {
  const userDataDir = path.join(outDir, 'userdata')
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(
    path.join(userDataDir, 'window-state.json'),
    JSON.stringify({
      width: jbWidth,
      height: winHeight,
      x: termWidth,
      y: TOP,
      isMaximized: false,
      isFullScreen: false,
    }),
  )

  renderer = await serve(path.join(desktopRoot, 'build'))
  const require = createRequire(path.join(desktopRoot, 'package.json'))
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
  await waitForApp(socketPath, 90_000)
  await delay(4000)

  const mcpConfig = path.join(outDir, 'mcp-config.json')
  fs.writeFileSync(
    mcpConfig,
    JSON.stringify(
      {
        mcpServers: {
          jbrowse: {
            command: 'node',
            args: [path.join(desktopRoot, 'build/mcpServer.js')],
          },
        },
      },
      null,
      2,
    ),
  )

  const cwd = path.join(outDir, 'cwd')
  fs.mkdirSync(cwd, { recursive: true })
  const system = take.SYSTEM
    ? take.SYSTEM(cwd)
    : [
        'You are driving JBrowse Desktop over MCP for a screen recording.',
        'Be direct and friendly: accomplish each request with as few tool calls as possible, then reply in one warm, plain-English sentence a non-expert understands.',
        'Do NOT inspect, modify, or remove plugins or configuration.',
        'Leave nothing open over the view: hide the track selector once the track is on, so the genome fills the window.',
        'After each change call jb.waitReady and confirm the track actually drew before answering.',
      ].join(' ')

  console.log('starting the real Claude Code session…')
  tmux('new-session', '-d', '-s', SESSION, '-c', cwd, '-x', COLS, '-y', ROWS)
  tmux('set-option', '-t', SESSION, 'focus-events', 'on')
  tmux('set-option', '-t', SESSION, 'status', 'off')
  // The invocation goes in a script rather than down the wire. A take's system
  // prompt runs past a thousand characters, and zsh's line editor never submits
  // a send-keys line that long — it redraws it, echoes it truncated and sits
  // there. It also keeps the command on camera short enough to read.
  // No --verbose: with the TUI in frame the viewer is reading the real
  // conversation, and the verbose stream buries it under tool-call plumbing
  // and per-turn context accounting. recordDemoTui.mjs keeps it because there
  // it IS the picture.
  const startScript = path.join(cwd, 'start-session.sh')
  fs.writeFileSync(
    startScript,
    `#!/bin/sh\nexec claude --model sonnet \\\n  --mcp-config ${JSON.stringify(mcpConfig)} --strict-mcp-config \\\n  --allowedTools '${MCP_TOOLS}${SHELL ? ',Bash,Read,Write,Edit,Glob,Grep' : ''}' \\\n  --append-system-prompt ${JSON.stringify(system)}\n`,
  )
  fs.chmodSync(startScript, 0o755)
  tmux('send-keys', '-t', SESSION, './start-session.sh', 'Enter')
  if (!(await waitTuiReady(SESSION))) {
    const pane = capture(SESSION)
    fs.writeFileSync(path.join(outDir, 'tui-stuck.txt'), pane)
    console.error(pane.split('\n').slice(-25).join('\n'))
    fail(
      `the Claude Code TUI never reached its prompt — pane saved to ${path.join(outDir, 'tui-stuck.txt')}`,
    )
  }
  await delay(1500)

  // Font size first: Terminal answers a font change by resizing the WINDOW to
  // keep its column count, so setting bounds first just gets undone. The size
  // is a property of the shared profile, hence the save and the restore.
  savedFontSize = Number(
    osa(
      `tell application "Terminal" to get font size of settings set "${PROFILE}"`,
    ),
  )
  osa(
    `tell application "Terminal" to set font size of settings set "${PROFILE}" to ${FONT_SIZE}`,
  )
  termWindowId = Number(
    osa(`tell application "Terminal"
           do script "tmux attach -t ${SESSION}"
           set bounds of front window to {0, ${TOP}, ${termWidth}, ${TOP + winHeight}}
           get id of front window
         end tell`),
  )
  await delay(3000)
  console.log(
    `terminal is ${tmux('display', '-p', '-t', SESSION, '#{client_width}x#{client_height}').trim()} at ${FONT_SIZE}pt`,
  )

  const term = findWindow({ owner: 'Terminal' })
  if (!term) {
    fail('no Terminal window to film')
  }
  placeWindow('Electron', {
    x: termWidth,
    y: TOP,
    w: jbWidth,
    h: winHeight,
  })
  await delay(1500)
  const jb = findWindow({ owner: 'Electron', minWidth: 400 })
  if (!jb) {
    fail('no JBrowse window to film')
  }
  console.log(
    `terminal ${term.w}x${term.h} at ${term.x},${term.y} · jbrowse ${jb.w}x${jb.h} at ${jb.x},${jb.y}`,
  )

  const framesDir = path.join(outDir, 'frames')
  camera = startCamera({
    sources: [
      { key: 'term', windowId: term.id },
      { key: 'jb', windowId: jb.id },
    ],
    outDir: framesDir,
    intervalMs: 250,
  })
  await delay(2000)
  if (camera.frames === 0) {
    fail(
      'the camera captured nothing — Screen Recording permission for this terminal is the usual cause',
    )
  }
  console.log('filming both windows by id…')

  const t0 = Date.now()
  const cameraStartedAt = t0
  const cues = [
    {
      start: 0,
      end: 4.5,
      text: 'A real Claude Code session driving JBrowse Desktop — every command on the left is Claude’s own.',
    },
  ]

  let checked = false
  for (const step of STEPS) {
    const start = (Date.now() - t0) / 1000
    console.log(`\n❯ ${step.prompt}`)
    const before = capture(SESSION)
    await typePrompt(SESSION, step.prompt)
    // 40 minutes, not 15: turn one of a take can carry a whole-genome
    // alignment, and the cap firing mid-turn desynchronises the harness from
    // the agent — it types the next prompt into a session still working on the
    // last one.
    if (!(await waitTurnDone(SESSION, before, 2_400_000))) {
      console.error('  (turn did not settle before timeout; continuing)')
    }
    // The window can only be measured through the app, which needs a session,
    // and which turn opens one is the take's business rather than this
    // harness's: a take that aligns two genomes before it opens anything has
    // none for ten minutes. So this retries after each turn and only judges
    // what it actually measured. It used to run once after turn one and let
    // the bridge's "no session" rejection go unhandled, which killed the node
    // process, and cleanup() then killed tmux — reported as "can't find
    // session", three lines away from the real cause.
    if (!checked) {
      const geom = await appViewport(socketPath).catch(() => undefined)
      if (geom) {
        if (geom.w > geom.screen * 0.65) {
          fail(
            `JBrowse is not tiled: its window is ${geom.w}px of a ${geom.screen}px screen`,
          )
        }
        console.log(`  layout confirmed by the app: ${geom.w}x${geom.h}`)
        checked = true
      }
    }
    fs.appendFileSync(
      path.join(outDir, 'panes.log'),
      `\n===== ${step.prompt} =====\n${capture(SESSION)}\n`,
    )
    const end = (Date.now() - t0) / 1000
    cues.push({ start: start + 0.3, end: end + 1.5, text: step.say })
    await delay(2500)
  }
  await delay(3000)
  cues.at(-1).end = (Date.now() - t0) / 1000

  console.log('stopping recording…')
  const filmedMs = Date.now() - cameraStartedAt
  const { frames, missed } = await camera.stop()
  camera = undefined
  if (frames === 0) {
    fail('no frames were captured')
  }
  const fps = frames / (filmedMs / 1000)
  console.log(
    `${frames} frames in ${(filmedMs / 1000).toFixed(0)}s (${fps.toFixed(1)} fps)${
      missed ? `, ${missed} ticks dropped` : ''
    }`,
  )

  const sources = [{ key: 'term' }, { key: 'jb' }]
  const framesDir2 = path.join(outDir, 'frames')
  const raw = path.join(outDir, 'demo.mp4')
  encode({ sources, outDir: framesDir2, file: raw, fps })
  const fast = path.join(outDir, 'demo-3x.mp4')
  encode({ sources, outDir: framesDir2, file: fast, fps, speed: 3 })

  if (cues.some(c => c.text)) {
    writeCaptions(path.join(outDir, 'captions.ass'), cues, {
      font: 'Helvetica',
    })
  }
  console.log(`\n${raw}`)
  console.log(fast)
  console.log(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height:format=duration',
      '-of',
      'default=nw=1',
      raw,
    ]).toString(),
  )
} finally {
  cleanup()
}
