// Films JBrowse Desktop while a real Claude Code session drives it over MCP.
//
// Three MCP connections: Claude Code's own (spawned by the CLI from
// mcp-config.json), a camera that screenshots the window on a loop, and a
// stage that paints the caption overlay from Claude's streamed messages. The
// captions are what Claude actually said and actually sent — nothing here
// authors the JavaScript on screen.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

// this file's own checkout, so a worktree films the build it holds rather than
// whichever one was hardcoded
const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
)
const desktopRoot = path.join(repoRoot, 'products/jbrowse-desktop')
const outDir = process.argv[2] ?? path.join(process.cwd(), 'agent-demo')
const framesDir = path.join(outDir, 'frames')
fs.mkdirSync(framesDir, { recursive: true })

// Short, and the way someone would actually type them. Everything else is the
// agent's problem, which is the point of filming one.
const TURNS = [
  'Open hg38 at CDKN1A, with genes and vertebrate conservation.',
  'Add the human ATAC-seq from GEO that compares nutlin against a vehicle control, as one stacked track.',
  'Show me log2 nutlin over vehicle across this view, as its own track.',
  'Zoom to about 20kb around the biggest gain and check every track really drew.',
]

function socketPath() {
  const label = os.userInfo().username.replaceAll(/[^\w.-]+/g, '_')
  return path.join(os.tmpdir(), `jbrowse-desktop-mcp-${label}`, 'mcp.sock')
}

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

const delay = ms => new Promise(r => setTimeout(r, ms))

async function waitForBridge(timeoutMs) {
  const sock = socketPath()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const up = await new Promise(resolve => {
      const s = net.createConnection(sock, () => {
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
      throw new Error(`bridge ${sock} never came up`)
    }
    await delay(1000)
  }
}

function startMcpClient(tag) {
  const child = spawn('node', [path.join(desktopRoot, 'build/mcpServer.js')], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const waiters = []
  readline.createInterface({ input: child.stdout }).on('line', line => {
    waiters.shift()?.(JSON.parse(line))
  })
  let nextId = 0
  const rpc = (method, params) => {
    const id = ++nextId
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
    )
    return new Promise(resolve => waiters.push(resolve))
  }
  async function call(name, args = {}) {
    const res = await rpc('tools/call', { name, arguments: args })
    const content = res.result?.content ?? []
    if (res.error || res.result?.isError) {
      throw new Error(
        `${tag}/${name}: ${res.error?.message ?? content[0]?.text ?? 'tool error'}`,
      )
    }
    return content
  }
  return { rpc, call, stop: () => child.stdin.end() }
}

// ---------------------------------------------------------------- captions

const CAPTION_JS = state => `
  try {
    while (session.queueOfDialogs?.length) { session.removeActiveDialog() }
    session.hideAllWidgets?.()
  } catch (e) {}
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))
  const S = ${JSON.stringify(state)}
  // The strip sits BELOW the app rather than over it. An overlay makes the
  // agent fight the harness: asked to keep the stack in the window it measures
  // the viewport, finds the bottom covered, and squeezes tracks for a reason
  // that is not JBrowse's.
  const root = document.getElementById('root')
  if (root && root.style.height !== 'calc(100% - 84px)') {
    root.style.height = 'calc(100% - 84px)'
  }
  let el = document.getElementById('mcp-demo-caption')
  if (!el) {
    el = document.createElement('div')
    el.id = 'mcp-demo-caption'
    el.style.cssText = [
      'position:fixed','left:0','right:0','bottom:0','height:84px','z-index:2147483647',
      'box-sizing:border-box','pointer-events:none','background:#0b0d11',
      'font-family:system-ui,-apple-system,sans-serif','color:#e9edf3',
      'padding:14px 22px','border-top:1px solid rgba(255,255,255,0.10)',
    ].join(';')
    document.body.appendChild(el)
  }
  el.innerHTML =
    '<div style="font-size:17px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      '<span style="color:#7aa2f7">you \\u276f </span>' + esc(S.question) +
    '</div>' +
    '<div style="font-size:12px;color:#8fa3b8;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">' +
      esc(S.status) +
    '</div>'
  return true
`

// ------------------------------------------------------------------- main

let app
let renderer
let claude
const frames = []
// an object rather than a bare let: the camera loop and the shutdown below
// run in different async contexts, and flow analysis reads a local boolean as
// never reassigned
const filming = { on: true }

try {
  // fix the window so takes are comparable frame for frame
  const stateFile = path.join(
    os.homedir(),
    'Library/Application Support/jbrowse-desktop/window-state.json',
  )
  if (fs.existsSync(path.dirname(stateFile))) {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        width: 1400,
        height: 800,
        x: 120,
        y: 100,
        isMaximized: false,
        isFullScreen: false,
      }),
    )
  }
  renderer = await serveRendererBuild()
  const require = createRequire(path.join(desktopRoot, 'package.json'))
  app = spawn(require('electron'), ['.', '--no-sandbox'], {
    cwd: desktopRoot,
    stdio: 'ignore',
    env: {
      ...process.env,
      DEV_SERVER_URL: `http://localhost:${renderer.port}`,
    },
  })
  await waitForBridge(90_000)

  const camera = startMcpClient('camera')
  const stage = startMcpClient('stage')
  await camera.rpc('initialize', { protocolVersion: '2025-06-18' })
  await stage.rpc('initialize', { protocolVersion: '2025-06-18' })

  const cameraLoop = (async () => {
    const t0 = Date.now()
    let n = 0
    while (filming.on) {
      const started = Date.now()
      try {
        const content = await camera.call('screenshot', { timeoutMs: 0 })
        const img = content.find(c => c.type === 'image')
        if (Date.now() - started > 1500) {
          console.error(`[cam] slow shot ${Date.now() - started}ms`)
        }
        if (img) {
          const file = path.join(
            framesDir,
            `f${String(n++).padStart(5, '0')}.png`,
          )
          fs.writeFileSync(file, Buffer.from(img.data, 'base64'))
          frames.push({ file, t: Date.now() - t0 })
        }
      } catch (e) {
        console.error(`[cam] ${e.message.slice(0, 100)}`)
      }
      await delay(200)
    }
  })()

  const state = { question: TURNS[0], status: '' }
  let painting = Promise.resolve()
  const paint = () => {
    painting = painting
      .then(() => stage.call('run_javascript', { code: CAPTION_JS(state) }))
      .catch(() => {})
    return painting
  }

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
      '--restricted',
      '--allowedTools',
      'mcp__jbrowse__run_javascript,mcp__jbrowse__open,mcp__jbrowse__docs,mcp__jbrowse__screenshot',
      // offered but not allowlisted is worse than absent: the model tries one,
      // gets denied, and narrates the denial on camera
      '--disallowedTools',
      'WebSearch,WebFetch,Task,TodoWrite',
    ],
    { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
  )
  claude.stderr.on('data', d => {
    process.stderr.write(`[claude] ${d}`)
  })

  const transcript = []
  let turnDone
  const turnFinished = () => new Promise(resolve => (turnDone = resolve))

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
          state.status = block.text.trim().replaceAll(/\s+/g, ' ')
          console.log(`  claude: ${state.status.slice(0, 120)}`)
          void paint()
        }
        // the CLI's own schema-fetch step is plumbing, not the demo
        if (
          block.type === 'tool_use' &&
          block.name.startsWith('mcp__jbrowse__')
        ) {
          const tool = block.name.replace('mcp__jbrowse__', '')
          const arg = String(
            block.input?.code ??
              block.input?.target ??
              block.input?.topic ??
              '',
          )
            .trim()
            .replaceAll(/\s+/g, ' ')
          state.status = `${tool} ${arg}`
          console.log(`  -> ${state.status.slice(0, 110)}`)
          void paint()
        }
      }
    }
    if (ev.type === 'result') {
      console.log(`  [turn done in ${ev.duration_ms}ms]`)
      turnDone?.()
    }
  })

  for (const [i, question] of TURNS.entries()) {
    console.log(`\n=== ${question}`)
    state.question = question
    state.status = ''
    await paint()
    await delay(1200)
    const finished = turnFinished()
    claude.stdin.write(
      `${JSON.stringify({
        type: 'user',
        message: { role: 'user', content: question },
      })}\n`,
    )
    await finished
    await delay(i === TURNS.length - 1 ? 5000 : 3500)
  }

  claude.stdin.end()
  console.log('\nsettled final screenshot')
  const shot = await camera.call('screenshot', { timeoutMs: 45000 })
  const finalImg = shot.find(c => c.type === 'image')
  if (finalImg) {
    fs.writeFileSync(
      path.join(outDir, 'final.png'),
      Buffer.from(finalImg.data, 'base64'),
    )
  }
  await delay(1500)

  filming.on = false
  await cameraLoop
  // The questions asked, beside the events. The CLI echoes its own output but
  // not the turns fed to its stdin, so a transcript alone cannot say what was
  // asked — which is the first thing a reviewer wants to read.
  fs.writeFileSync(
    path.join(outDir, 'transcript.json'),
    JSON.stringify({ questions: TURNS, events: transcript }, null, 2),
  )
  if (frames.length) {
    fs.writeFileSync(
      path.join(outDir, 'frames.txt'),
      `${frames
        .map((f, i) => {
          const dur = ((frames[i + 1]?.t ?? f.t + 250) - f.t) / 1000
          return `file '${f.file}'\nduration ${dur.toFixed(3)}`
        })
        .join('\n')}\nfile '${frames.at(-1).file}'\n`,
    )
  }
  console.log(`\n${frames.length} frames -> ${outDir}`)
} finally {
  filming.on = false
  await delay(400)
  claude?.kill()
  renderer?.close()
  app?.kill()
}
