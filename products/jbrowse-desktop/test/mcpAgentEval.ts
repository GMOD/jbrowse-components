// Agent eval: launches the built app, and for each task in agentEvalTasks.ts
// resets the volvox baseline, runs a real `claude -p` session against the MCP
// server, then grades the SESSION STATE over the bridge. The transcript is
// counted, never graded: run_javascript calls, errored calls, docs reads,
// screenshots, turns, seconds, dollars.
//
// A filmed take is one sample a day; this is ten tasks in minutes, so a change
// to the instructions, the docs or `jb` is judged by calls-to-success and
// errors rather than by argument.
//
// Prereqs: `pnpm --filter @jbrowse/desktop build && build:electron-main`, and
// `claude` on PATH. Under xvfb: `pnpm --filter @jbrowse/desktop eval:mcp:headless`.
//
// Usage: node test/mcpAgentEval.ts [--model sonnet|opus] [--filter name]
//        [--runs N] [--out dir] [--attach]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

import { BASELINE_SPEC, TASKS } from './agentEvalTasks.ts'
import { desktopRoot, openVolvox, repoRoot } from './mcpHarness.ts'

import type { McpClient } from './mcpHarness.ts'

const args = process.argv.slice(2)
function flag(name: string, fallback: string) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : (args[i + 1] ?? fallback)
}
const model = flag('model', 'sonnet')
const filter = flag('filter', '')
const runs = Number(flag('runs', '1'))
const outDir = path.resolve(
  flag('out', path.join(os.tmpdir(), `jbrowse-agent-eval-${Date.now()}`)),
)
const attach = args.includes('--attach')

const MCP_TOOLS = [
  'mcp__jbrowse__run_javascript',
  'mcp__jbrowse__docs',
  'mcp__jbrowse__screenshot',
  'mcp__jbrowse__open',
]

const SYSTEM = `You are driving JBrowse Desktop over its MCP tools. A session is already open. Do the task using the tools, verify the result, then reply with one line. Do not ask questions; make reasonable choices yourself.`

interface StreamEvent {
  type: string
  message?: {
    content?: {
      type: string
      name?: string
      input?: Record<string, unknown>
      is_error?: boolean
      content?: unknown
    }[]
  }
  duration_ms?: number
  total_cost_usd?: number
  num_turns?: number
  result?: string
}

interface RunMetrics {
  task: string
  run: number
  pass: boolean
  detail: unknown
  answer: string
  runJavascript: number
  errored: number
  docs: number
  screenshots: number
  open: number
  turns: number
  seconds: number
  usd: number
}

function stripClaudeEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')),
  )
}

async function runAgent(prompt: string, cwd: string, mcpConfig: string) {
  const events: StreamEvent[] = []
  const child = spawn(
    'claude',
    [
      '-p',
      prompt,
      '--model',
      model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--mcp-config',
      mcpConfig,
      '--strict-mcp-config',
      '--allowedTools',
      MCP_TOOLS.join(','),
      '--disallowedTools',
      'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Task,TodoWrite',
      '--append-system-prompt',
      SYSTEM,
      '--max-turns',
      '40',
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
  await new Promise<void>(resolve => {
    child.on('close', () => {
      resolve()
    })
  })
  return events
}

function count(events: StreamEvent[]) {
  const calls = {
    runJavascript: 0,
    errored: 0,
    docs: 0,
    screenshots: 0,
    open: 0,
  }
  for (const ev of events) {
    for (const block of ev.message?.content ?? []) {
      if (block.type === 'tool_use') {
        const name = (block.name ?? '').replace(/^mcp__jbrowse__/, '')
        if (name === 'run_javascript') {
          calls.runJavascript += 1
        } else if (name === 'docs') {
          calls.docs += 1
        } else if (name === 'screenshot') {
          calls.screenshots += 1
        } else if (name === 'open') {
          calls.open += 1
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

async function grade(client: McpClient, code: string, answer: string) {
  const graded = await client.callJson('run_javascript', {
    code: `const answer = ${JSON.stringify(answer)}\n${code}`,
    timeoutMs: 60_000,
  })
  const value = graded.value as { pass?: boolean; detail?: unknown } | undefined
  return { pass: value?.pass === true, detail: value?.detail ?? graded }
}

fs.mkdirSync(outDir, { recursive: true })
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-agent-eval-cwd-'))
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

const tasks = TASKS.filter(t => !filter || t.name.includes(filter))
const metrics: RunMetrics[] = []
const session = await openVolvox(attach)
try {
  for (const task of tasks) {
    for (let run = 1; run <= runs; run++) {
      await session.client.callJson('run_javascript', {
        code: BASELINE_SPEC,
        timeoutMs: 120_000,
      })
      if (task.setup) {
        await session.client.callJson('run_javascript', {
          code: task.setup,
          timeoutMs: 60_000,
        })
      }
      const prompt = task.prompt.replaceAll('REPO', repoRoot)
      const events = await runAgent(prompt, cwd, mcpConfig)
      const counted = count(events)
      const verdict = await grade(session.client, task.grade, counted.answer)
      const row: RunMetrics = { task: task.name, run, ...verdict, ...counted }
      metrics.push(row)
      fs.writeFileSync(
        path.join(outDir, `${task.name}-${run}.json`),
        JSON.stringify({ task, row, events }, null, 2),
      )
      console.log(
        `${row.pass ? 'pass' : 'FAIL'}  ${task.name.padEnd(20)} js=${row.runJavascript} err=${row.errored} docs=${row.docs} shots=${row.screenshots} turns=${row.turns} ${row.seconds}s $${row.usd}`,
      )
      if (!row.pass) {
        console.log(`      ${JSON.stringify(row.detail)}`)
        console.log(`      answer: ${row.answer.slice(0, 200)}`)
      }
    }
  }
} finally {
  session.stop()
}

const passed = metrics.filter(m => m.pass).length
const sum = (key: keyof RunMetrics) =>
  metrics.reduce((a, m) => a + Number(m[key]), 0)
console.log(
  `\n${passed}/${metrics.length} passed on ${model}; run_javascript ${sum('runJavascript')}, errored ${sum('errored')}, docs ${sum('docs')}, screenshots ${sum('screenshots')}, ${sum('seconds')}s, $${sum('usd').toFixed(2)}`,
)
fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify({ model, metrics }, null, 2),
)
console.log(`results: ${outDir}`)
process.exitCode = passed === metrics.length ? 0 : 1
