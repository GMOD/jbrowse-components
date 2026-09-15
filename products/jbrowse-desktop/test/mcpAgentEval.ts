// Agent eval: launches the built app, and for each task in scripts/agent-evals/tasks.ts
// resets the volvox baseline, runs a real `claude -p` session against the MCP
// server, then grades the SESSION STATE over the bridge. The transcript is
// counted, never graded: run_javascript calls, errored calls, docs reads,
// screenshots, turns, seconds, dollars.
//
// A filmed take is one sample a day; this is a dozen tasks in minutes, so a
// change to the instructions, the docs or `jb` is judged by calls-to-success
// and errors rather than by argument.
//
// Pass rate stopped discriminating once every task passed, so the run also
// accounts for what the server SPENT: the result event's four token counts,
// and the text a client actually paid for — tool_result chars attributed to
// the tool that produced them (by tool_use_id), image blocks counted, and the
// topic/section/search of every docs read. A server that answers the same
// tasks in fewer chars is the improvement those numbers show.
//
// `--client desktop` runs the second condition. Claude Code shows the model
// the initialize response's `instructions` and Claude Desktop does not
// (anthropics/claude-ai-mcp#93), so the default measures one client only;
// the flag routes the same server through scripts/agent-evals/desktopClientProxy.ts,
// which drops that field.
//
// Prereqs: `pnpm --filter @jbrowse/desktop build` (its postbuild writes
// build/mcpServer.js), and `claude` on PATH. Under xvfb:
// `pnpm --filter @jbrowse/desktop eval:mcp:headless`.
//
// Usage: node test/mcpAgentEval.ts [--model sonnet|opus] [--filter name]
//        [--runs N] [--out dir] [--client code|desktop] [--attach]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

import { BASELINE_SPEC, TASKS } from '../../../scripts/agent-evals/tasks.ts'
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
const client = flag('client', 'code')
const outDir = path.resolve(
  flag('out', path.join(os.tmpdir(), `jbrowse-agent-eval-${Date.now()}`)),
)
const attach = args.includes('--attach')

if (client !== 'code' && client !== 'desktop') {
  throw new Error(`--client takes "code" or "desktop", not "${client}"`)
}

const MCP_TOOLS = [
  'mcp__jbrowse__run_javascript',
  'mcp__jbrowse__docs',
  'mcp__jbrowse__screenshot',
  'mcp__jbrowse__open',
]

const SYSTEM = `You are driving JBrowse Desktop over its MCP tools. A session is already open. Do the task using the tools, verify the result, then reply with one line. Do not ask questions; make reasonable choices yourself.`

interface ContentBlock {
  type: string
  name?: string
  id?: string
  input?: Record<string, unknown>
  is_error?: boolean
  tool_use_id?: string
  content?: unknown
  text?: string
}

interface Usage {
  input_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  output_tokens?: number
}

interface StreamEvent {
  type: string
  message?: { content?: ContentBlock[] }
  duration_ms?: number
  total_cost_usd?: number
  num_turns?: number
  usage?: Usage
  result?: string
}

interface RunMetrics {
  task: string
  run: number
  client: string
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
  tokensIn: number
  cacheWrite: number
  cacheRead: number
  tokensOut: number
  // tool_result text the model was handed, by the tool that produced it
  chars: Record<string, number>
  images: number
  docsArgs: string[]
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

const toolName = (block: ContentBlock) =>
  (block.name ?? '').replace(/^mcp__jbrowse__/, '')

// A tool_result's content is a list of blocks in the runs seen so far and a
// bare string in the schema, so both shapes are measured.
function resultText(content: unknown) {
  if (typeof content === 'string') {
    return { chars: content.length, images: 0 }
  }
  let chars = 0
  let images = 0
  for (const block of Array.isArray(content)
    ? (content as ContentBlock[])
    : []) {
    if (block.type === 'image') {
      images += 1
    } else if (typeof block.text === 'string') {
      chars += block.text.length
    }
  }
  return { chars, images }
}

function count(events: StreamEvent[]) {
  const calls = {
    runJavascript: 0,
    errored: 0,
    docs: 0,
    screenshots: 0,
    open: 0,
  }
  const chars: Record<string, number> = {}
  const docsArgs: string[] = []
  // a tool_result names only the id it answers, so the tool it cost is the
  // tool_use that id belongs to
  const nameById = new Map<string, string>()
  let images = 0
  for (const ev of events) {
    for (const block of ev.message?.content ?? []) {
      if (block.type === 'tool_use') {
        const name = toolName(block)
        if (block.id) {
          nameById.set(block.id, name)
        }
        if (name === 'run_javascript') {
          calls.runJavascript += 1
        } else if (name === 'docs') {
          calls.docs += 1
          const { topic, section, search } = block.input ?? {}
          docsArgs.push(
            [topic, section, search].filter(Boolean).map(String).join('/') ||
              '(no args)',
          )
        } else if (name === 'screenshot') {
          calls.screenshots += 1
        } else if (name === 'open') {
          calls.open += 1
        }
      }
      if (block.type === 'tool_result') {
        if (block.is_error) {
          calls.errored += 1
        }
        const name = nameById.get(block.tool_use_id ?? '') ?? 'other'
        const measured = resultText(block.content)
        chars[name] = (chars[name] ?? 0) + measured.chars
        images += measured.images
      }
    }
  }
  const result = events.find(ev => ev.type === 'result')
  const usage = result?.usage ?? {}
  return {
    ...calls,
    chars,
    images,
    docsArgs,
    turns: result?.num_turns ?? 0,
    seconds: Math.round((result?.duration_ms ?? 0) / 1000),
    usd: Number((result?.total_cost_usd ?? 0).toFixed(3)),
    tokensIn: usage.input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    tokensOut: usage.output_tokens ?? 0,
    answer: result?.result ?? '',
  }
}

// An agent that finished on the `open` tool leaves the renderer navigating,
// and the bridge answers the next call with "still loading" rather than
// waiting. That is the agent's state to be graded, so the grader waits for it.
async function grade(mcp: McpClient, code: string, answer: string) {
  const deadline = Date.now() + 120_000
  for (;;) {
    try {
      const graded = await mcp.callJson('run_javascript', {
        code: `const answer = ${JSON.stringify(answer)}\n${code}`,
        timeoutMs: 60_000,
      })
      const value = graded.value as
        | { pass?: boolean; detail?: unknown }
        | undefined
      return { pass: value?.pass === true, detail: value?.detail ?? graded }
    } catch (e) {
      if (!`${e}`.includes('still loading') || Date.now() > deadline) {
        throw e
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

const charsLine = (chars: Record<string, number>) =>
  Object.entries(chars)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name}=${n}`)
    .join(' ') || 'none'

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
}

fs.mkdirSync(outDir, { recursive: true })
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-agent-eval-cwd-'))
const serverPath = path.join(desktopRoot, 'build/mcpServer.js')
const proxyPath = path.join(
  repoRoot,
  'scripts/agent-evals/desktopClientProxy.ts',
)
const mcpConfig = path.join(outDir, 'mcp-config.json')
fs.writeFileSync(
  mcpConfig,
  JSON.stringify({
    mcpServers: {
      jbrowse: {
        command: 'node',
        args: client === 'desktop' ? [proxyPath, serverPath] : [serverPath],
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
      const prompt = task.prompt.replaceAll('DATA', repoRoot)
      const events = await runAgent(prompt, cwd, mcpConfig)
      const counted = count(events)
      const verdict = await grade(session.client, task.grade, counted.answer)
      const row: RunMetrics = {
        task: task.name,
        run,
        client,
        ...verdict,
        ...counted,
      }
      metrics.push(row)
      fs.writeFileSync(
        path.join(outDir, `${task.name}-${run}.json`),
        JSON.stringify({ task, row, events }, null, 2),
      )
      console.log(
        `${row.pass ? 'pass' : 'FAIL'}  ${task.name.padEnd(20)} js=${row.runJavascript} err=${row.errored} docs=${row.docs} shots=${row.screenshots} turns=${row.turns} ${row.seconds}s $${row.usd}`,
      )
      console.log(
        `      tok in=${row.tokensIn} cacheW=${row.cacheWrite} cacheR=${row.cacheRead} out=${row.tokensOut} | chars ${charsLine(row.chars)} img=${row.images}${row.docsArgs.length > 0 ? ` | docs ${row.docsArgs.join(', ')}` : ''}`,
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
const charTotals: Record<string, number> = {}
for (const m of metrics) {
  for (const [name, n] of Object.entries(m.chars)) {
    charTotals[name] = (charTotals[name] ?? 0) + n
  }
}
const medians = tasks.map(task => {
  const rows = metrics.filter(m => m.task === task.name)
  const of = (pick: (m: RunMetrics) => number) => median(rows.map(pick))
  return {
    task: task.name,
    runJavascript: of(m => m.runJavascript),
    errored: of(m => m.errored),
    tokens: of(m => m.tokensIn + m.cacheWrite + m.cacheRead + m.tokensOut),
    chars: of(m => Object.values(m.chars).reduce((a, n) => a + n, 0)),
    seconds: of(m => m.seconds),
  }
})

console.log(
  `\n${passed}/${metrics.length} passed on ${model} (client ${client}); run_javascript ${sum('runJavascript')}, errored ${sum('errored')}, docs ${sum('docs')}, screenshots ${sum('screenshots')}, ${sum('seconds')}s, $${sum('usd').toFixed(2)}`,
)
console.log(
  `tokens in ${sum('tokensIn')}, cache write ${sum('cacheWrite')}, cache read ${sum('cacheRead')}, out ${sum('tokensOut')}; tool_result chars ${charsLine(charTotals)}, images ${sum('images')}`,
)
if (runs > 1) {
  console.log('\nper-task medians over the runs')
  for (const m of medians) {
    console.log(
      `  ${m.task.padEnd(20)} js=${m.runJavascript} err=${m.errored} tokens=${m.tokens} chars=${m.chars} ${m.seconds}s`,
    )
  }
}
fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify(
    {
      model,
      client,
      runs,
      passed,
      total: metrics.length,
      totals: {
        runJavascript: sum('runJavascript'),
        errored: sum('errored'),
        docs: sum('docs'),
        screenshots: sum('screenshots'),
        open: sum('open'),
        turns: sum('turns'),
        seconds: sum('seconds'),
        usd: Number(sum('usd').toFixed(2)),
        tokensIn: sum('tokensIn'),
        cacheWrite: sum('cacheWrite'),
        cacheRead: sum('cacheRead'),
        tokensOut: sum('tokensOut'),
        chars: charTotals,
        images: sum('images'),
      },
      medians,
      metrics,
    },
    null,
    2,
  ),
)
console.log(`results: ${outDir}`)
process.exitCode = passed === metrics.length ? 0 : 1
