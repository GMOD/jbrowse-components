// Films Claude Code inside the Claude desktop app driving JBrowse Desktop,
// side by side, on macOS.
//
//   node scripts/agent-demos/recordDemoApp.mjs <outdir> [takes/<name>.mjs]
//
// recordDemoMac.mjs is the same take, same camera and same encode with the
// Claude Code TUI in a terminal instead. What changes is only the client half,
// and all of it lives in appClient.mjs: there is no tmux to send keys to and
// no pane to capture, so prompts are typed with CGEvents and a turn ends when
// the conversation pane has been seen to change and then gone still.
//
// Everything the CLI harness passes as a flag has to be arranged in the app
// instead: the take's SYSTEM becomes <cwd>/CLAUDE.md, --allowedTools becomes
// the permission mode (Auto, the product default, which is what a viewer
// gets), and the MCP server goes in the app's own config because a user-scope
// ~/.claude.json entry and a project .mcp.json are both ignored here.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'

import {
  activateApp,
  collapseSidebar,
  conversationHash,
  dismissBanners,
  dismissTrust,
  installMcpServer,
  mcpServerLoaded,
  openSession,
  placeWindow,
  quitAndWait,
  quitApp,
  restoreMcpServer,
  selectModel,
  shot,
  typePrompt,
  waitForWindow,
  waitTurnDone,
} from './appClient.mjs'
import {
  appViewport,
  defaultSocketPath,
  delay,
  serve,
  waitForApp,
  writeCaptions,
} from './demoCore.mjs'
import { findWindow } from './macTools.mjs'
import { encode, startCamera } from './windowCamera.mjs'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
)
const desktopRoot = path.join(repoRoot, 'products/jbrowse-desktop')
const mcpServerPath = path.join(desktopRoot, 'build/mcpServer.js')
const outDir = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), 'jbrowse-app-demo'),
)
// Sonnet: what the three published takes used, and the takes' turn plans were
// written against it. Row 2 of the menu counting from the top (Fable, Opus,
// Sonnet, Haiku) — clicked rather than typed, because the digit accelerators
// the menu prints did not take and failed silently.
const MODEL_ROW = 2
const DRY_RUN = process.argv.includes('--dry-run')
const CLAUDE_WIDTH = 720

function fail(msg) {
  console.error(`\n${msg}\n`)
  process.exit(1)
}

for (const bin of ['ffmpeg', 'magick', 'swiftc']) {
  if (spawnSync('which', [bin]).status !== 0) {
    fail(`${bin} is not on PATH`)
  }
}
if (!fs.existsSync('/Applications/Claude.app')) {
  fail('Claude.app is not installed')
}
if (!fs.existsSync(mcpServerPath)) {
  fail(
    `${mcpServerPath} is missing — run: pnpm --filter @jbrowse/desktop build`,
  )
}

const takeArg = process.argv.slice(3).find(a => !a.startsWith('--'))
const take = takeArg ? await import(path.resolve(takeArg)) : {}
const STEPS =
  take.STEPS ?? (take.TURNS ?? []).map(prompt => ({ prompt, say: '' }))
if (!STEPS.length) {
  fail('the take module exports no STEPS or TURNS')
}

// An INSTALLED JBrowse Desktop running beside the take is worse than a second
// window: 4.3.0 serves no bridge at all, so the socket check below passes, the
// repo build gets launched, and an operator watching the installed app sees an
// agent report success over an app that never moved. Cost a take on 2026-09-08.
if (
  spawnSync('pgrep', ['-f', '/Applications/JBrowse 2.app/Contents/MacOS'])
    .status === 0
) {
  fail(
    'the installed JBrowse Desktop (/Applications/JBrowse 2.app) is running — quit it. On 4.3.0 it serves no MCP bridge, so an agent cannot reach it and the take films the wrong app.',
  )
}

// A crashed take leaves the socket file behind, so existence alone is not the
// question — whether something answers on it is.
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
  fs.rmSync(socketPath, { force: true })
}

fs.mkdirSync(outDir, { recursive: true })
const scratch = path.join(outDir, 'probes')
fs.mkdirSync(scratch, { recursive: true })

let renderer
let app
let camera
function cleanup() {
  camera?.stop()
  restoreMcpServer()
  quitApp()
  app?.kill()
  renderer?.close()
}
process.on('exit', cleanup)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    process.exit(1)
  })
}

const screen = {
  w: Number(
    spawnSync('osascript', [
      '-e',
      'tell application "Finder" to get item 3 of (get bounds of window of desktop)',
    ])
      .stdout.toString()
      .trim(),
  ),
  h: Number(
    spawnSync('osascript', [
      '-e',
      'tell application "Finder" to get item 4 of (get bounds of window of desktop)',
    ])
      .stdout.toString()
      .trim(),
  ),
}
const TOP = 25
const DOCK = 120
const winHeight = screen.h - TOP - DOCK
const jbWidth = screen.w - CLAUDE_WIDTH

try {
  const cwd = path.join(outDir, 'cwd')
  fs.mkdirSync(cwd, { recursive: true })
  if (take.SYSTEM) {
    // the app has no --append-system-prompt, and a CLAUDE.md in the session's
    // own folder is the only channel that reaches it before the first turn
    //
    // The tool paths are resolved here rather than left to PATH: the app is
    // launched through LaunchServices, so it does not inherit the shell
    // environment this harness runs in, and the jbrowse CLI in particular
    // sits behind an fnm shim a GUI process never sees. A take that discovers
    // that on camera has burnt its first turn on `command not found`.
    const cli = path.join(repoRoot, 'products/jbrowse-cli/dist/bin.js')
    const tools = ['minimap2', 'samtools', 'bgzip', 'tabix']
      .map(name => {
        const found = spawnSync('which', [name], { encoding: 'utf8' })
        return found.status === 0
          ? `- ${name}: ${found.stdout.trim()}`
          : undefined
      })
      .filter(Boolean)
    if (fs.existsSync(cli)) {
      // the repo's own CLI, not whatever `which jbrowse` finds: that is an fnm
      // multishell shim whose path dies with the shell that launched it
      tools.push(`- jbrowse CLI: ${process.execPath} ${cli}`)
    }
    fs.writeFileSync(
      path.join(cwd, 'CLAUDE.md'),
      `${take.SYSTEM(cwd)}\n${
        tools.length
          ? `\nThese tools are installed at absolute paths; call them by full path, since they may not be on this session's PATH:\n\n${tools.join('\n')}\n`
          : ''
      }`,
    )
  }

  // Before the app launches: it reads its config once, at startup, and spawns
  // one server child per surface.
  installMcpServer(mcpServerPath)

  const userDataDir = path.join(outDir, 'userdata')
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(
    path.join(userDataDir, 'window-state.json'),
    JSON.stringify({
      width: jbWidth,
      height: winHeight,
      x: CLAUDE_WIDTH,
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
  await delay(3000)

  console.log('starting the Claude Code session in the app…')
  if (!(await quitAndWait())) {
    fail(
      'the Claude app would not quit — a running app makes the deep link open a session in ITS workspace, not the take folder',
    )
  }
  openSession(cwd)
  let win = await waitForWindow()
  await delay(4000)
  activateApp()
  await delay(1500)

  if (!mcpServerLoaded(mcpServerPath)) {
    fail(
      'the app did not spawn the MCP server — check the mcpServers entry in claude_desktop_config.json',
    )
  }

  // The trust modal is up on every launch with Cancel focused, and its
  // ABSENCE means the deep link did not open the folder we asked for — which
  // is how a take once ran against a leftover probe directory.
  const trust = await dismissTrust(win, scratch)
  if (trust === 'absent') {
    fail(
      `no trust modal appeared for ${cwd}, so this session is not in the take folder — the deep link focused a running app instead of opening the folder. Probes in ${scratch}`,
    )
  }
  if (trust === 'stuck') {
    fail(
      `the trust modal is still up: the confirm click missed. Probes in ${scratch}`,
    )
  }

  // Placement first: every offset below is derived from the frame, and the
  // sidebar and banner probes were both calibrated at the filmed size.
  placeWindow({ x: 0, y: TOP, w: CLAUDE_WIDTH, h: winHeight })
  await delay(2000)
  // re-read through the waiter rather than appWindow(): the frame moved, and
  // every offset below is derived from it
  win = await waitForWindow(10_000)
  console.log(`claude ${win.w}x${win.h} at ${win.x},${win.y}`)

  if (!(await collapseSidebar(win, scratch))) {
    fail(
      `the sidebar would not close — it shows the account email and every past session title. Probes in ${scratch}`,
    )
  }
  await dismissBanners(win, scratch)
  if (!(await selectModel(win, scratch, MODEL_ROW))) {
    fail(
      `the model did not change — the label beside the effort setting is unchanged, so the take would film on whatever was already selected. Probes in ${scratch}`,
    )
  }
  // banners can arrive during the model round trip
  await dismissBanners(win, scratch, 2)
  const setup = shot(win, path.join(outDir, 'setup.png'))
  console.log(`setup frame: ${setup}`)
  if (DRY_RUN) {
    console.log('--dry-run: stopping before the camera, no turns spent')
    process.exit(0)
  }

  const jb = findWindow({ owner: 'Electron', minWidth: 400 })
  if (!jb) {
    fail('no JBrowse window to film')
  }
  console.log(`jbrowse ${jb.w}x${jb.h} at ${jb.x},${jb.y}`)

  const framesDir = path.join(outDir, 'frames')
  // Started after the first prompt is SENT, not before: until a session has a
  // message the app shows its home view, which carries the account's session
  // count, total tokens and a "you have used N times more tokens than <book>"
  // line. That is account data, and the encoder collapsing it to half a second
  // does not make it publishable.
  async function startFilming() {
    camera = startCamera({
      sources: [
        { key: 'claude', windowId: win.id },
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
  }

  let t0 = Date.now()
  const cues = [
    {
      start: 0,
      end: 4.5,
      text: 'A real Claude Code session in the Claude app, driving JBrowse Desktop over MCP.',
    },
  ]

  let checked = false
  for (const [index, step] of STEPS.entries()) {
    const start = (Date.now() - t0) / 1000
    console.log(`\n> ${step.prompt}`)
    // taken before the prompt is typed, so a turn cannot be declared done
    // over a screen that never changed
    const before = conversationHash(win, scratch, 'before-turn')
    await typePrompt(win, step.prompt)
    if (index === 0) {
      // the home view is gone the moment the first message lands
      await delay(1500)
      await startFilming()
      t0 = Date.now()
    }
    const log = path.join(outDir, 'turn-samples.log')
    fs.appendFileSync(log, `\n===== ${step.prompt} =====\n`)
    if (!(await waitTurnDone(win, scratch, { before, log }))) {
      console.error('  (turn did not settle before the cap; continuing)')
    }
    // no transcript exists on disk for an app session, so the window itself is
    // the reviewable record — the panes.log of this harness
    shot(
      win,
      path.join(outDir, `turn-${String(index + 1).padStart(2, '0')}.png`),
    )
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
    await dismissBanners(win, scratch, 1)
    cues.push({
      start: start + 0.3,
      end: (Date.now() - t0) / 1000 + 1.5,
      text: step.say,
    })
    await delay(2500)
  }
  await delay(3000)
  cues.at(-1).end = (Date.now() - t0) / 1000

  console.log('stopping recording…')
  const filmedMs = Date.now() - t0
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

  const sources = [{ key: 'claude' }, { key: 'jb' }]
  const raw = path.join(outDir, 'demo.mp4')
  encode({ sources, outDir: framesDir, file: raw, fps })
  encode({
    sources,
    outDir: framesDir,
    file: path.join(outDir, 'demo-3x.mp4'),
    fps,
    speed: 3,
  })
  if (cues.some(c => c.text)) {
    writeCaptions(path.join(outDir, 'captions.ass'), cues, {
      font: 'Helvetica',
    })
  }
  console.log(`\n${raw}`)
} finally {
  cleanup()
}
