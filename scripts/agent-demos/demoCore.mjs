// The parts of a TUI take that are the same on every platform: serving the
// renderer build, talking to the running app's bridge, driving the Claude Code
// TUI through tmux, and writing the caption track. recordDemoTui.mjs supplies
// the GNOME half, recordDemoMac.mjs the macOS half.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

export const delay = ms =>
  new Promise(r => {
    setTimeout(r, ms)
  })

export function defaultSocketPath() {
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

export function serve(buildDir) {
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

// The app's bridge speaks newline-delimited {id, tool, args} on the same socket
// the MCP server relays to, so a harness can ask the running app a question
// directly rather than inferring the answer off the screen.
export function bridgeCall(socketPath, tool, args, timeoutMs = 30_000) {
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
      if (nl >= 0) {
        const msg = JSON.parse(buf.slice(0, nl))
        done(msg.error ? new Error(msg.error) : undefined, msg.result)
      }
    })
    s.on('error', e => {
      done(e)
    })
  })
}

// `app_version` is the one call the bridge answers before a session exists, and
// the app makes its window before it starts the bridge — so an answer here
// means there is a window to place.
export async function waitForApp(socketPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      return await bridgeCall(socketPath, 'app_version', {})
    } catch (e) {
      if (Date.now() > deadline) {
        throw new Error('JBrowse never became reachable', { cause: e })
      }
      await delay(1000)
    }
  }
}

// What the app itself thinks its window is, which is the only measurement that
// cannot disagree with what the camera sees. Needs a session, so it can only be
// asked once the take's first turn has opened one.
export async function appViewport(socketPath) {
  const result = await bridgeCall(socketPath, 'run_javascript', {
    code: 'return { w: window.innerWidth, h: window.innerHeight, screen: window.screen.width }',
  })
  return result?.value
}

export const tmux = (...args) =>
  execFileSync('tmux', args.map(String), { encoding: 'utf8' })

export function capture(session) {
  try {
    return tmux('capture-pane', '-p', '-t', session)
  } catch {
    return ''
  }
}

// A send-keys per character costs a process spawn, which on a busy machine is
// ~300ms rather than the perCharMs below — a 340-character prompt then takes
// most of two minutes, and typing is the one thing the encoder cannot collapse
// because every frame differs. Small chunks keep the typed-out look and cut the
// spawns by CHUNK.
const CHUNK = 4

export async function typePrompt(session, text, perCharMs = 28) {
  for (let i = 0; i < text.length; i += CHUNK) {
    tmux('send-keys', '-t', session, '-l', text.slice(i, i + CHUNK))
    await delay(perCharMs * CHUNK)
  }
  await delay(400)
  tmux('send-keys', '-t', session, 'Enter')
}

// Whether the TUI is mid-turn. The marker has moved between versions: 2.1.263
// draws a spinner line like "✽ Newspapering… (5s · ↓ 186 tokens)" and never
// says "esc to interrupt", which older builds did. The elapsed counter is the
// stable part, and the finished line ("Cooked for 19s · done") has no
// parenthesis, so it does not read as still working.
//
// Match the unit, not just seconds: past a minute the counter reads "(1m 32s",
// and a pattern anchored on digits-then-s stops matching exactly when a turn is
// long enough to matter. A take then calls the turn done mid-thought, and the
// recording stops over a working agent.
const isWorking = pane =>
  /esc to interrupt/i.test(pane) || /\(\d+[hms]\b/.test(pane)

// Done means the spinner was seen and then went away with the pane settled.
// Waiting for the spinner first is the whole point: the pane changes the
// instant the prompt is typed, so settling alone declares a turn finished
// before the model has started it.
export async function waitTurnDone(session, before, maxMs = 300_000) {
  const deadline = Date.now() + maxMs
  // The escape hatch for a turn whose spinner never matched. It has to outlast
  // the app's own startup on a loaded machine: at 25s it fired before the agent
  // had begun, the caller took that as a finished turn, and the bridge call
  // after it hit an app with no session yet.
  const graceUntil = Date.now() + 90_000
  let sawWorking = false
  let stablePane = ''
  let stableCount = 0
  while (Date.now() < deadline) {
    await delay(1500)
    const pane = capture(session)
    if (isWorking(pane)) {
      sawWorking = true
      stableCount = 0
    } else if (sawWorking || Date.now() > graceUntil) {
      if (pane === stablePane && pane !== before) {
        stableCount++
        if (stableCount >= 2) {
          return true
        }
      } else {
        stablePane = pane
        stableCount = 0
      }
    }
  }
  return false
}

// Claude Code opens on a chooser whenever something about the session is new,
// and a take meets several: it runs in a fresh directory, and a machine with the
// Chrome extension installed is asked about that too. Each one swallows the
// prompts typed at it — the Enter ending the first prompt picks whatever is
// highlighted, which for the trust dialog is "No, exit", after which the rest of
// the sentence falls through to the shell. That is how a take once filmed vim
// editing a file called `human`.
//
// `❯` is no help in spotting them: it is the cursor in the chooser itself, and a
// common shell prompt besides, so matching it declares the TUI ready before it
// exists. Match what only a live TUI draws.
const STARTUP_DIALOGS = [
  // highlighted option is "No, exit", so take the one below it
  {
    what: 'folder trust',
    match: /project you created or one you trust/i,
    keys: ['Down', 'Enter'],
  },
  // highlighted option is "No, keep browser tools off", which is what a take
  // wants — it drives JBrowse, not a browser
  {
    what: 'chrome browser tools',
    match: /Claude in Chrome extension detected/i,
    keys: ['Enter'],
  },
]

// Readiness markers, newest first. These are the status line, so they move
// whenever Claude Code restyles it: 2.1.263 draws
// `claude | cwd-4e | Sonnet 5 | medium | 0/1M 0% | $0.00` over
// `⏵⏵ auto mode on (shift+tab to cycle) · ← for agents`, which carries none of
// the three older markers. Keep the old ones: a stale alternative costs
// nothing, and a missing one costs a take with "never reached its prompt" over
// a TUI that is plainly sitting at its prompt.
const TUI_READY =
  /shift\+tab to cycle|\d+\/\d+[KM]\b|\d+\s+tokens|bypass permissions|\? for shortcuts/

export async function waitTuiReady(session, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  const answered = new Set()
  while (Date.now() < deadline) {
    await delay(1000)
    const pane = capture(session)
    const dialog = STARTUP_DIALOGS.find(
      d => !answered.has(d.what) && d.match.test(pane),
    )
    if (dialog) {
      console.log(`  answering the ${dialog.what} prompt`)
      for (const key of dialog.keys) {
        tmux('send-keys', '-t', session, key)
        await delay(400)
      }
      answered.add(dialog.what)
    } else if (TUI_READY.test(pane)) {
      return true
    }
  }
  return false
}

function assTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = (sec % 60).toFixed(2).padStart(5, '0')
  return `${h}:${String(m).padStart(2, '0')}:${s}`
}

function wrap(text, width) {
  const lines = []
  let line = ''
  for (const w of text.split(' ')) {
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

export function writeCaptions(file, cues, { font = 'DejaVu Sans' } = {}) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narr, ${font}, 36, &H00FFFFFF, &H20000000, &H00000000, 1, 3, 8, 0, 2, 80, 80, 24, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const lines = cues.map(
    c =>
      `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Narr,,0,0,0,,${wrap(c.text, 62)}`,
  )
  fs.writeFileSync(file, `${header + lines.join('\n')}\n`)
}
