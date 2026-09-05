// Records a real Claude Code session driving JBrowse Desktop over MCP, on a
// GNOME/Wayland desktop, to an mp4. The macOS harness (agentDemo.mjs) films
// only the JBrowse window through a screenshot loop and paints a caption strip;
// this one records the WHOLE screen through GNOME's own screencast, so the
// actual Claude session — running in a visible terminal beside the app — is in
// frame. That was the gap: the published clips never show Claude itself.
//
//   node scripts/agent-demos/recordDemoLinux.mjs <outdir> [takes/<name>.mjs]
//
// Needs, first: `pnpm --filter @jbrowse/desktop build`, a GNOME/Wayland session
// (XDG_SESSION_TYPE=wayland), no other JBrowse Desktop running (the bridge
// socket is per-user), and `claude` on PATH. Writes <outdir>/demo.mp4.
//
// Wayland places windows itself — a client cannot position itself, and there is
// no scriptable tiling without an input-injection daemon. So the two windows
// may open stacked; tap Super+Left on the terminal and Super+Right on JBrowse
// once to tile them. Everything else is automatic.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
)
const desktopRoot = path.join(repoRoot, 'products/jbrowse-desktop')
const outDir = process.argv[2] ?? path.join(process.cwd(), 'jbrowse-demo')
fs.mkdirSync(outDir, { recursive: true })

const DEFAULT_TAKE = {
  TURNS: [
    'Open the human genome hg38 at BRCA1, showing a gene track.',
    'Navigate to the largest exon of BRCA1 and tell me its coordinates.',
    'Take stock: list what views and tracks are open and confirm every track drew.',
  ],
  SHELL: false,
  SYSTEM: () => '',
}

const take = process.argv[3]
  ? await import(path.resolve(process.argv[3]))
  : DEFAULT_TAKE
const TURNS = take.TURNS
const SHELL = take.SHELL ?? false
const SYSTEM = take.SYSTEM ?? (() => '')

const delay = ms =>
  new Promise(r => {
    setTimeout(r, ms)
  })

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

// ---------------------------------------------------------- preconditions

if (process.env.XDG_SESSION_TYPE !== 'wayland') {
  console.error(
    `warning: XDG_SESSION_TYPE is "${process.env.XDG_SESSION_TYPE}", not "wayland" — the GNOME screencast path expects a Wayland session.`,
  )
}
if (!fs.existsSync(path.join(desktopRoot, 'build/index.html'))) {
  fail('no desktop build — run `pnpm --filter @jbrowse/desktop build` first.')
}
if (spawnSync('claude', ['--version'], { stdio: 'ignore' }).error) {
  fail('`claude` is not on PATH.')
}
const socketPath = (() => {
  const label = os.userInfo().username.replaceAll(/[^\w.-]+/g, '_')
  return path.join(os.tmpdir(), `jbrowse-desktop-mcp-${label}`, 'mcp.sock')
})()
if (fs.existsSync(socketPath)) {
  fail(
    `an MCP bridge socket already exists at ${socketPath} — close the running JBrowse Desktop first (its bridge is per-user and this launches its own).`,
  )
}

// ---------------------------------------------------------- serve the build

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
function serveRendererBuild() {
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
    if (up) {
      return
    }
    if (Date.now() > deadline) {
      fail(`the JBrowse Desktop bridge never came up at ${socketPath}`)
    }
    await delay(1000)
  }
}

// The live session terminal a viewer reads: a formatted tail of the real claude
// stream, so the recording shows the actual questions, Claude's replies and the
// exact code each run_javascript call runs — not a paraphrase.
const sessionLog = path.join(outDir, 'session.log')
fs.writeFileSync(sessionLog, '')
function logLine(s) {
  fs.appendFileSync(sessionLog, `${s}\n`)
}

let app
let renderer
let claude
let recorder
let sessionTerm
const cleanup = () => {
  try {
    fs.writeFileSync(path.join(outDir, 'stop.flag'), '')
  } catch {}
  claude?.kill()
  sessionTerm?.kill()
  renderer?.close()
  app?.kill()
}
process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})

try {
  // isolated profile so the demo never touches a real session, recent list or
  // autosave; window-state.json lives directly under userData
  // (windowStateKeeper.ts), and its width/height seed the window. Wayland places
  // the window itself, so x/y are best-effort.
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

  renderer = await serveRendererBuild()
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
  await waitForBridge(90_000)

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

  logLine('  Claude Code · JBrowse Desktop over MCP')
  logLine('')
  // the visible "actual Claude window": a terminal tailing the live session
  sessionTerm = spawn(
    'gnome-terminal',
    [
      '--geometry=94x54',
      '--title=Claude session',
      '--',
      'bash',
      '-lc',
      `tail -n +1 -f ${JSON.stringify(sessionLog)}`,
    ],
    { stdio: 'ignore' },
  )

  await delay(1500)
  console.log('starting screen recording…')
  const stopFlag = path.join(outDir, 'stop.flag')
  fs.rmSync(stopFlag, { force: true })
  recorder = spawn(
    'python3',
    [
      path.join(repoRoot, 'scripts/agent-demos/recorder.py'),
      path.join(outDir, 'demo'),
      stopFlag,
      String(20 * 60),
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  )
  let recordedPath = path.join(outDir, 'demo.mp4')
  readline.createInterface({ input: recorder.stdout }).on('line', line => {
    console.log(`  [rec] ${line}`)
    const m = /path=(.+)$/.exec(line)
    if (m) {
      recordedPath = m[1]
    }
  })
  await delay(1500)

  const cwd = path.join(outDir, 'cwd')
  fs.mkdirSync(cwd, { recursive: true })
  const mcpTools =
    'mcp__jbrowse__run_javascript,mcp__jbrowse__open,mcp__jbrowse__docs,mcp__jbrowse__screenshot'
  const system = SYSTEM(cwd)
  claude = spawn(
    'claude',
    [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--mcp-config',
      mcpConfig,
      '--strict-mcp-config',
      ...(SHELL
        ? ['--allowedTools', `${mcpTools},Bash,Read,Write,Edit,Glob,Grep`]
        : ['--restricted', '--allowedTools', mcpTools]),
      ...(system ? ['--append-system-prompt', system] : []),
      '--disallowedTools',
      'WebSearch,WebFetch,Task,TodoWrite',
    ],
    { cwd, stdio: ['pipe', 'pipe', 'inherit'] },
  )

  const transcript = []
  let turnDone
  const turnFinished = () =>
    new Promise(resolve => {
      turnDone = resolve
    })
  readline.createInterface({ input: claude.stdout }).on('line', line => {
    let ev
    try {
      ev = JSON.parse(line)
    } catch {
      return
    }
    transcript.push(ev)
    if (ev.type === 'assistant') {
      for (const block of ev.message?.content ?? []) {
        if (block.type === 'text' && block.text.trim()) {
          logLine(`\n  ${block.text.trim().replaceAll(/\n+/g, '\n  ')}`)
        }
        if (
          block.type === 'tool_use' &&
          (block.name.startsWith('mcp__jbrowse__') ||
            ['Bash', 'Read', 'Write', 'Edit'].includes(block.name))
        ) {
          const tool = block.name.replace('mcp__jbrowse__', '')
          const arg = String(
            block.input?.code ??
              block.input?.command ??
              block.input?.target ??
              block.input?.topic ??
              '',
          ).trim()
          logLine(
            `\n  → ${tool}${arg ? `  ${arg.replaceAll(/\s+/g, ' ')}` : ''}`,
          )
        }
      }
    }
    if (ev.type === 'result') {
      turnDone?.()
    }
  })

  for (const [i, question] of TURNS.entries()) {
    console.log(`\n=== ${question}`)
    logLine(`\n❯ ${question}`)
    await delay(1000)
    const finished = turnFinished()
    claude.stdin.write(
      `${JSON.stringify({
        type: 'user',
        message: { role: 'user', content: question },
      })}\n`,
    )
    await finished
    await delay(i === TURNS.length - 1 ? 4000 : 2500)
  }
  claude.stdin.end()
  logLine('\n  ✓ session complete')
  await delay(2500)

  console.log('stopping recording…')
  fs.writeFileSync(stopFlag, '')
  await new Promise(resolve => recorder.on('exit', resolve))
  await delay(500)

  fs.writeFileSync(
    path.join(outDir, 'transcript.json'),
    JSON.stringify(
      { questions: TURNS, system, shell: SHELL, events: transcript },
      null,
      2,
    ),
  )

  // a poster from one second in, and an even-dimension normalized copy so the
  // file plays everywhere
  if (fs.existsSync(recordedPath)) {
    const finalMp4 = path.join(outDir, 'demo.mp4')
    if (recordedPath !== finalMp4) {
      spawnSync('ffmpeg', ['-y', '-i', recordedPath, '-c', 'copy', finalMp4], {
        stdio: 'ignore',
      })
    }
    spawnSync(
      'ffmpeg',
      [
        '-y',
        '-ss',
        '1',
        '-i',
        finalMp4,
        '-frames:v',
        '1',
        path.join(outDir, 'poster.png'),
      ],
      { stdio: 'ignore' },
    )
    console.log(`\n✓ ${finalMp4}`)
  } else {
    console.error(
      `\n✗ no recording at ${recordedPath} — check GNOME screencast`,
    )
  }
} finally {
  cleanup()
}
