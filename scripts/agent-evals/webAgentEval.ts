// Browser-agent eval: the desktop eval's twin for jbrowse-web driven through
// the Claude in Chrome extension. For each task in tasks.ts it resets the
// volvox baseline in the page, runs a real `claude -p --chrome` session, then
// grades the PAGE STATE through the bridge pageBridge.ts injects into the
// served build. The transcript is counted, never graded.
//
// What differs from the desktop eval is what the browser client is: no docs
// tool, a 45 s budget per evaluation, sanitized results, and `window.jb`
// found by the agent rather than handed to it. By default the agent gets one
// line saying window.jb exists, the way the side-panel clip tells a viewer;
// `--guide` appends the live-model guide as system prompt, the condition
// webDemo.mjs filmed.
//
// Prereqs: `pnpm --filter @jbrowse/web build`; Chrome running with the Claude
// extension signed in, on a display; `claude` on PATH with a direct login (an
// API key disables the Chrome integration). The device id comes from the
// extension's list_connected_browsers; pass --device, or it is discovered by
// one probe session.
//
// Usage: node scripts/agent-evals/webAgentEval.ts [--device id] [--model m]
//        [--filter name] [--runs N] [--out dir] [--build dir] [--guide]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { servePageBridge } from './pageBridge.ts'
import { BASELINE_SPEC, TASKS } from './tasks.ts'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const args = process.argv.slice(2)
function flag(name: string, fallback: string) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : (args[i + 1] ?? fallback)
}
const model = flag('model', 'sonnet')
const filter = flag('filter', '')
const runs = Number(flag('runs', '1'))
const buildDir = path.resolve(
  flag('build', path.join(repoRoot, 'products/jbrowse-web/build')),
)
const outDir = path.resolve(
  flag('out', path.join(os.tmpdir(), `jbrowse-web-agent-eval-${Date.now()}`)),
)
const withGuide = args.includes('--guide')
let deviceId = flag('device', '')

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  throw new Error(
    `no jbrowse-web build at ${buildDir}: pnpm --filter @jbrowse/web build`,
  )
}

const CONFIG = 'test_data/volvox/config.json'

interface StreamEvent {
  type: string
  message?: {
    content?: {
      type: string
      name?: string
      input?: { action?: string }
      is_error?: boolean
    }[]
  }
  duration_ms?: number
  total_cost_usd?: number
  num_turns?: number
  result?: string
}

function stripClaudeEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')),
  )
}

function claudeChrome(
  prompt: string,
  systemPrompt: string,
  cwd: string,
  maxTurns: number,
) {
  const events: StreamEvent[] = []
  const child = spawn(
    'claude',
    [
      '-p',
      prompt,
      '--chrome',
      '--model',
      model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--allowedTools',
      'mcp__claude-in-chrome,ToolSearch',
      '--disallowedTools',
      'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Task,TodoWrite',
      '--append-system-prompt',
      systemPrompt,
      '--max-turns',
      String(maxTurns),
    ],
    { cwd, env: stripClaudeEnv(), stdio: ['ignore', 'pipe', 'inherit'] },
  )
  readline.createInterface({ input: child.stdout }).on('line', line => {
    try {
      events.push(JSON.parse(line) as StreamEvent)
    } catch {
      // not an event line
    }
  })
  return new Promise<StreamEvent[]>(resolve => {
    child.on('close', () => {
      resolve(events)
    })
  })
}

async function discoverDevice(cwd: string) {
  const events = await claudeChrome(
    'Call list_connected_browsers and reply with ONLY the raw JSON it returned.',
    'You are a probe. Make the one tool call asked for and reply with its raw result.',
    cwd,
    4,
  )
  const text = events.find(ev => ev.type === 'result')?.result ?? ''
  const found = /"deviceId"\s*:\s*"([^"]+)"/.exec(text)
  if (!found) {
    throw new Error(
      `could not read a deviceId from the probe's answer: ${text.slice(0, 300)}`,
    )
  }
  return found[1]!
}

// a new tab in the running Chrome, which is the one route to a page without a
// debugger of our own; the bridge then reports the page polling
function openTab(url: string) {
  spawn('google-chrome', ['--profile-directory=Default', url], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ':0' },
  }).unref()
}

function count(events: StreamEvent[]) {
  const calls = {
    javascript: 0,
    navigate: 0,
    screenshots: 0,
    other: 0,
    errored: 0,
  }
  for (const ev of events) {
    for (const block of ev.message?.content ?? []) {
      if (block.type === 'tool_use') {
        const name = (block.name ?? '').replace(/^mcp__claude-in-chrome__/, '')
        if (name === 'javascript_tool') {
          calls.javascript += 1
        } else if (name === 'navigate') {
          calls.navigate += 1
        } else if (
          name.includes('screenshot') ||
          (name === 'computer' &&
            (block.input?.action ?? 'screenshot') === 'screenshot')
        ) {
          calls.screenshots += 1
        } else {
          calls.other += 1
        }
      }
      if (block.type === 'tool_result' && block.is_error) {
        calls.errored += 1
      }
    }
  }
  const result = events.find(ev => ev.type === 'result')
  return {
    ...calls,
    turns: result?.num_turns ?? 0,
    seconds: Math.round((result?.duration_ms ?? 0) / 1000),
    usd: Number((result?.total_cost_usd ?? 0).toFixed(3)),
    answer: result?.result ?? '',
  }
}

fs.mkdirSync(outDir, { recursive: true })
const cwd = fs.mkdtempSync(
  path.join(os.tmpdir(), 'jbrowse-web-agent-eval-cwd-'),
)
const bridge = await servePageBridge(buildDir)
const appUrl = `${bridge.url}?config=${CONFIG}`
console.log(`serving ${buildDir} at ${bridge.url}`)

if (!deviceId) {
  deviceId = await discoverDevice(cwd)
  console.log(`connected browser ${deviceId}`)
}

const guide = withGuide
  ? `\n\n# Reference for the jb library\n${fs.readFileSync(path.join(repoRoot, 'website/docs/agents_live_model.md'), 'utf8')}`
  : ''
const systemPrompt = `You are driving JBrowse Web, a genome browser, through the Claude in Chrome tools. The JBrowse tab is already open at ${appUrl} in the only connected browser, whose deviceId is ${deviceId}: call select_browser with it before the first browser action and do not ask which browser to use. The page exposes a helper library on window.jb; evaluate jb.help for the contract, then orient with jb.sessionSummary(). javascript_tool returns the last expression of the code you pass. Do the task, verify the result, then reply with one line. Do not ask questions; do not open other sites.${guide}`

// The tab the agent drove is reloaded at the config so every task starts from
// the same page; a tab the agent left on another origin has no bridge to
// reload through, so a new one is opened beside it. Either way the reset
// waits for a load newer than itself, never for a fixed sleep.
async function resetPage() {
  const before = Date.now()
  const page = bridge.current()
  if (page) {
    await bridge
      .evaluate(`location.assign(${JSON.stringify(appUrl)})`, {
        page,
        timeoutMs: 5000,
      })
      .catch(() => {})
  } else {
    openTab(appUrl)
  }
  await bridge.waitForPage(60_000, before)
  await bridge.evaluate(
    `for (let i = 0; i < 200 && !window.jb; i++) { await new Promise(r => setTimeout(r, 250)) }
     if (!window.jb) { throw new Error('window.jb never appeared') }
     return true`,
    { timeoutMs: 70_000 },
  )
  await bridge.evaluate(BASELINE_SPEC, { timeoutMs: 120_000 })
}

interface RunMetrics {
  task: string
  run: number
  pass: boolean
  detail: unknown
  answer: string
  javascript: number
  navigate: number
  screenshots: number
  other: number
  errored: number
  turns: number
  seconds: number
  usd: number
}

const tasks = TASKS.filter(t => !filter || t.name.includes(filter))
const metrics: RunMetrics[] = []
try {
  for (const task of tasks) {
    for (let run = 1; run <= runs; run++) {
      await resetPage()
      if (task.setup) {
        await bridge.evaluate(task.setup)
      }
      const prompt = task.prompt.replaceAll(
        'DATA',
        bridge.url.replace(/\/$/, ''),
      )
      const events = await claudeChrome(prompt, systemPrompt, cwd, 40)
      const counted = count(events)
      let verdict: { pass: boolean; detail: unknown }
      try {
        const graded = (await bridge.evaluate(task.grade, {
          answer: counted.answer,
        })) as { pass?: boolean; detail?: unknown } | null
        verdict = { pass: graded?.pass === true, detail: graded?.detail }
      } catch (e) {
        verdict = {
          pass: false,
          detail: `grader threw: ${e instanceof Error ? e.message : String(e)}`,
        }
      }
      const row: RunMetrics = { task: task.name, run, ...verdict, ...counted }
      metrics.push(row)
      fs.writeFileSync(
        path.join(outDir, `${task.name}-${run}.json`),
        JSON.stringify({ task, row, events }, null, 2),
      )
      console.log(
        `${row.pass ? 'pass' : 'FAIL'}  ${task.name.padEnd(20)} js=${row.javascript} nav=${row.navigate} shots=${row.screenshots} other=${row.other} err=${row.errored} turns=${row.turns} ${row.seconds}s $${row.usd}`,
      )
      if (!row.pass) {
        console.log(`      ${JSON.stringify(row.detail)}`)
        console.log(`      answer: ${row.answer.slice(0, 200)}`)
      }
    }
  }
} finally {
  bridge.close()
}

const passed = metrics.filter(m => m.pass).length
const sum = (key: keyof RunMetrics) =>
  metrics.reduce((a, m) => a + Number(m[key]), 0)
console.log(
  `\n${passed}/${metrics.length} passed on ${model} in Chrome${withGuide ? ' with the guide' : ''}; javascript ${sum('javascript')}, navigate ${sum('navigate')}, screenshots ${sum('screenshots')}, errored ${sum('errored')}, ${sum('seconds')}s, $${sum('usd').toFixed(2)}`,
)
fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify({ model, guide: withGuide, metrics }, null, 2),
)
console.log(`results: ${outDir}`)
process.exitCode = passed === metrics.length ? 0 : 1
