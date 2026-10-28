// Chat-plugin eval: loads jbrowse-web with jbrowse-plugin-assistant-chatbot,
// types each task's prompt into the plugin's chat box, waits for the model to
// go quiet, then grades the PAGE STATE through pageBridge.ts like the other
// evals. The transcript is counted, never graded.
//
// The Anthropic key never reaches the browser. A local proxy holds it, adds it
// to each request the plugin sends to its base URL, counts the tokens and
// refuses calls once the estimated spend passes --budget. The page holds a
// placeholder key in the plugin's encrypted vault. With --provider ollama the
// proxy forwards to a local Ollama instead, which needs no key and costs nothing.
//
// Prereqs: `pnpm --filter @jbrowse/web build`; the plugin built with
// `npx rollup --config --environment JB_NPM:false,NODE_ENV:development`; a key
// file (default ~/.config/jbrowse-evals/anthropic.key); Chrome for puppeteer
// (PUPPETEER_EXECUTABLE_PATH=/opt/google/chrome/chrome if none is cached).
//
// Usage: node scripts/agent-evals/chatAgentEval.ts [--model m] [--filter name]
//        [--runs N] [--out dir] [--build dir] [--plugin dir] [--budget usd]
//        [--system-prompt file] [--set dev|heldout|tutorials|all] [--price-in usd/M] [--price-out usd/M]
//        [--provider anthropic|ollama] [--ollama-url url] [--cpu] [--no-think]
//        [--num-ctx tokens] [--solutions]
//
// --cpu sets num_gpu 0 on each Ollama request and launches Chrome with
// --disable-gpu, so nothing loads onto a GPU. --no-think turns off Ollama's
// reasoning, which a slow CPU model can spend a whole turn on. --num-ctx sets
// Ollama's context window, whose small default silently truncates the prompt.
// --solutions runs each task's solution in place of the model, to check the
// page and its graders with the plugin loaded.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer'

import { servePageBridge } from './pageBridge.ts'
import { BASELINE_SPEC, NOT_DRAWN, selectTasks, stageWork } from './tasks.ts'

import type { EvalTask, TaskSet } from './tasks.ts'
import type { Page } from 'puppeteer'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const args = process.argv.slice(2)
function flag(name: string, fallback: string) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : (args[i + 1] ?? fallback)
}
const provider = flag('provider', 'anthropic')
if (provider !== 'anthropic' && provider !== 'ollama') {
  throw new Error(`unknown --provider ${provider}`)
}
const ollamaUrl = new URL(flag('ollama-url', 'http://127.0.0.1:11434'))
const cpuOnly = args.includes('--cpu')
const noThink = args.includes('--no-think')
const numCtx = Number(flag('num-ctx', '0'))
const model = flag(
  'model',
  provider === 'ollama' ? 'qwen3:4b' : 'claude-sonnet-5-5',
)
const filter = flag('filter', '')
const runs = Number(flag('runs', '1'))
const taskSet = flag('set', 'all') as TaskSet
const budget = Number(flag('budget', '10'))
const priceIn =
  Number(flag('price-in', provider === 'ollama' ? '0' : '2')) / 1e6
const priceOut =
  Number(flag('price-out', provider === 'ollama' ? '0' : '10')) / 1e6
const buildDir = path.resolve(
  flag('build', path.join(repoRoot, 'products/jbrowse-web/build')),
)
const pluginDir = path.resolve(
  flag(
    'plugin',
    path.join(os.homedir(), 'src/jbrowse-plugin-assistant-chatbot'),
  ),
)
const keyFile = flag(
  'key-file',
  path.join(os.homedir(), '.config/jbrowse-evals/anthropic.key'),
)
const outDir = path.resolve(
  flag('out', path.join(os.tmpdir(), `jbrowse-chat-agent-eval-${Date.now()}`)),
)
const PASSWORD = 'eval-vault'
const PLUGIN_FILE = 'jbrowse-plugin-assistant-chatbot.umd.development.js'

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  throw new Error(`no jbrowse-web build at ${buildDir}`)
}
if (!fs.existsSync(path.join(pluginDir, 'dist', PLUGIN_FILE))) {
  throw new Error(`no plugin build at ${pluginDir}/dist`)
}
const apiKey =
  provider === 'anthropic' ? fs.readFileSync(keyFile, 'utf8').trim() : ''

const stats = {
  active: 0,
  started: 0,
  lastEnd: 0,
  inputTokens: 0,
  outputTokens: 0,
  toolLog: [] as string[],
  textTail: '',
}
const spend = () => stats.inputTokens * priceIn + stats.outputTokens * priceOut

function countUsage(body: string) {
  let outputs = 0
  for (const line of body.split('\n')) {
    if (!line.startsWith('data:')) {
      continue
    }
    try {
      const e = JSON.parse(line.slice(5))
      if (e.type === 'message_start') {
        const u = e.message?.usage ?? {}
        stats.inputTokens +=
          (u.input_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0)
      } else if (
        e.type === 'content_block_start' &&
        e.content_block?.type === 'tool_use'
      ) {
        stats.toolLog.push(`${e.content_block.name} `)
      } else if (
        e.type === 'content_block_delta' &&
        e.delta?.type === 'text_delta'
      ) {
        stats.textTail = (stats.textTail + e.delta.text).slice(-2500)
      } else if (
        e.type === 'content_block_delta' &&
        e.delta?.type === 'input_json_delta' &&
        stats.toolLog.length > 0
      ) {
        stats.toolLog[stats.toolLog.length - 1] += e.delta.partial_json
      } else if (e.type === 'message_delta') {
        outputs = e.usage?.output_tokens ?? outputs
      }
    } catch {}
  }
  stats.outputTokens += outputs
}

function countOllamaUsage(body: string) {
  for (const line of body.split('\n')) {
    try {
      const e = JSON.parse(line)
      for (const call of e.message?.tool_calls ?? []) {
        stats.toolLog.push(
          `${call.function?.name} ${JSON.stringify(call.function?.arguments)}`,
        )
      }
      if (e.message?.content) {
        stats.textTail = (stats.textTail + e.message.content).slice(-2500)
      }
      stats.inputTokens += e.prompt_eval_count ?? 0
      stats.outputTokens += e.eval_count ?? 0
    } catch {}
  }
}

function upstreamRequest(
  req: http.IncomingMessage,
  body: Buffer,
  onResponse: (up: http.IncomingMessage) => void,
) {
  return provider === 'ollama'
    ? http.request(
        {
          host: ollamaUrl.hostname,
          port: ollamaUrl.port,
          path: req.url,
          method: req.method,
          headers: {
            'content-type': 'application/json',
            'content-length': body.length,
          },
        },
        onResponse,
      )
    : https.request(
        {
          host: 'api.anthropic.com',
          path: req.url,
          method: req.method,
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': String(
              req.headers['anthropic-version'] ?? '2023-06-01',
            ),
            'content-type': 'application/json',
            'content-length': body.length,
          },
        },
        onResponse,
      )
}

function serveProxy() {
  const server = http.createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader(
      'access-control-allow-headers',
      String(req.headers['access-control-request-headers'] ?? '*'),
    )
    res.setHeader('access-control-allow-methods', '*')
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (spend() >= budget) {
      res.statusCode = 429
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          type: 'error',
          error: { type: 'rate_limit_error', message: 'eval budget reached' },
        }),
      )
      return
    }
    stats.active++
    stats.started++
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      let body = Buffer.concat(chunks)
      if (provider === 'anthropic') {
        try {
          const doc = JSON.parse(body.toString('utf8'))
          if (doc.thinking?.type === 'disabled') {
            doc.thinking = { type: 'between_tools' }
          }
          delete doc.temperature
          body = Buffer.from(JSON.stringify(doc))
        } catch {}
      } else if ((cpuOnly || noThink || numCtx) && body.length > 0) {
        const doc = JSON.parse(body.toString('utf8'))
        if (cpuOnly) {
          doc.options = { ...doc.options, num_gpu: 0 }
        }
        if (numCtx) {
          doc.options = { ...doc.options, num_ctx: numCtx }
        }
        if (noThink) {
          doc.think = false
        }
        body = Buffer.from(JSON.stringify(doc))
      }
      const upstream = upstreamRequest(req, body, up => {
        res.writeHead(up.statusCode ?? 502, {
          'content-type': String(
            up.headers['content-type'] ?? 'application/json',
          ),
          'cache-control': 'no-cache',
        })
        let seen = ''
        up.on('data', chunk => {
          res.write(chunk)
          seen += chunk.toString('utf8')
        })
        up.on('end', () => {
          res.end()
          if (provider === 'ollama') {
            countOllamaUsage(seen)
          } else {
            countUsage(seen)
          }
          stats.active--
          stats.lastEnd = Date.now()
        })
      })
      upstream.on('error', () => {
        res.statusCode = 502
        res.end()
        stats.active--
        stats.lastEnd = Date.now()
      })
      upstream.end(body)
    })
  })
  return new Promise<{ url: string; close: () => void }>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  })
}

const bridge = await servePageBridge(buildDir)
const configs = new Map<string, string>()

let hubOrigin = ''

const staticServer = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/plugin.js') {
    res.setHeader('content-type', 'text/javascript')
    fs.createReadStream(path.join(pluginDir, 'dist', PLUGIN_FILE)).pipe(res)
    return
  }
  const doc = configs.get(url.pathname.slice(1))
  if (doc !== undefined) {
    res.setHeader('content-type', 'application/json')
    res.end(doc)
    return
  }
  if (!hubOrigin) {
    res.statusCode = 404
    res.end()
    return
  }
  const range = req.headers.range
  const upstream = await fetch(`${hubOrigin}${url.pathname}${url.search}`, {
    headers: range ? { range } : {},
  }).catch(() => undefined)
  if (!upstream) {
    res.statusCode = 502
    res.end()
    return
  }
  const headers: Record<string, string> = {}
  for (const name of ['content-type', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) {
      headers[name] = value
    }
  }
  res.writeHead(upstream.status, headers)
  res.end(Buffer.from(await upstream.arrayBuffer()))
})
const staticUrl = await new Promise<string>(resolve => {
  staticServer.listen(0, '127.0.0.1', () => {
    resolve(
      `http://127.0.0.1:${(staticServer.address() as { port: number }).port}`,
    )
  })
})
const proxy = await serveProxy()

function absolutize(node: unknown, base: string) {
  if (Array.isArray(node)) {
    node.forEach(n => {
      absolutize(n, base)
    })
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    for (const [k, v] of Object.entries(obj)) {
      if (
        k === 'uri' &&
        typeof v === 'string' &&
        !/^[a-z][a-z0-9+.-]*:/i.test(v)
      ) {
        obj[k] = new URL(v, base).href
      } else {
        absolutize(v, base)
      }
    }
  }
}

async function configFor(task: EvalTask) {
  const hub = task.config ? new URL(task.config) : undefined
  const name = hub ? hub.pathname.slice(1) : 'volvox.json'
  if (hub) {
    hubOrigin = hub.origin
  }
  if (!configs.has(name)) {
    let doc: { plugins?: unknown[] }
    let base: string
    if (task.config) {
      doc = await (await fetch(task.config)).json()
      base = task.config
    } else {
      doc = JSON.parse(
        fs.readFileSync(
          path.join(buildDir, 'test_data/volvox/config.json'),
          'utf8',
        ),
      )
      base = `${bridge.url}test_data/volvox/config.json`
    }
    absolutize(doc, base)
    doc.plugins = [
      ...(doc.plugins ?? []),
      { name: 'AssistantChatbot', url: `${staticUrl}/plugin.js` },
    ]
    configs.set(name, JSON.stringify(doc))
  }
  return `${staticUrl}/${name}`
}

const require = createRequire(path.join(pluginDir, 'package.json'))
const passworder = require('@metamask/browser-passworder')
const vault: string = await passworder.encrypt(PASSWORD, {
  anthropic: 'proxy-placeholder',
})
const defaultPrompt =
  "You are an expert in biological processes and an assistant for answering questions regarding JBrowse 2, OR the user's running JBrowse 2 session.\n**No matter the question, you must provide a clear, accurate, and complete response to the question.**"
const promptFile = flag('system-prompt', '')
const systemPrompt = promptFile
  ? fs.readFileSync(promptFile, 'utf8').trim()
  : defaultPrompt
const settings = JSON.stringify({
  provider,
  providerSettings: {
    openai: { model: 'gpt-4o-mini' },
    anthropic: { baseUrl: proxy.url, model },
    google: { model: 'gemini-2.5-flash-lite' },
    ollama: { baseUrl: proxy.url, model },
  },
  defaultSystemPrompt: systemPrompt,
  useProviderSystemPrompt: false,
})

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function evaluateLive(code: string, timeoutMs: number, answer = '') {
  const page = await bridge.waitForPage(30_000)
  return bridge.evaluate(code, { timeoutMs, page, answer })
}

fs.mkdirSync(outDir, { recursive: true })
const launchBrowser = () =>
  puppeteer.launch({
    headless: true,
    args: cpuOnly ? ['--no-sandbox', '--disable-gpu'] : ['--no-sandbox'],
    protocolTimeout: 300_000,
  })
let browser = await launchBrowser()
const only = flag('tasks', '').split(',').filter(Boolean)
const tasks = selectTasks(taskSet, filter, 'web').filter(
  t => only.length === 0 || only.includes(t.name),
)
const rows: { task: string; run: number; pass: boolean }[] = []

const profileStalls = args.includes('--profile-stalls')
const waitMs = Number(flag('wait', '240')) * 1000
const retries = !args.includes('--no-retry')
const solutions = args.includes('--solutions')

async function profilePage(page: Page) {
  const client = await page.createCDPSession()
  await client.send('Profiler.enable')
  await client.send('Profiler.start')
  await sleep(4000)
  const { profile } = (await client.send('Profiler.stop')) as {
    profile: {
      nodes: {
        id: number
        callFrame: { functionName: string; url: string; lineNumber: number }
      }[]
      samples: number[]
    }
  }
  const byId = new Map(profile.nodes.map(n => [n.id, n.callFrame]))
  const counts = new Map<string, number>()
  for (const id of profile.samples) {
    const f = byId.get(id)
    const key = `${f?.functionName || '(anonymous)'} ${f?.url.split('/').pop()}:${f?.lineNumber}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  console.log(
    `profile of a run still going after 60 s (${profile.samples.length} samples):`,
  )
  for (const [key, n] of top) {
    console.log(`  ${String(n).padStart(6)}  ${key}`)
  }
}

async function runOnce(task: EvalTask, run: number, attempt: number) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  const pageLog: string[] = []
  page.on('console', m =>
    pageLog.push(`${m.type()}: ${m.text().slice(0, 400)}`),
  )
  page.on('pageerror', e =>
    pageLog.push(`pageerror: ${String(e).slice(0, 300)}`),
  )
  page.on('error', e => pageLog.push(`CRASH: ${String(e).slice(0, 300)}`))
  page.on('close', () => pageLog.push('page closed'))
  await page.evaluateOnNewDocument(
    (s: string, v: string) => {
      localStorage.setItem('chatbot-settings', s)
      localStorage.setItem('chatbot-vault', v)
      localStorage.setItem('chatbot-jb-approval', 'off')
      // a worker that fails its boot posts the reason and is terminated, and
      // the page then logs only "RPC worker was terminated" for every call
      const NativeWorker = window.Worker
      window.Worker = class extends NativeWorker {
        constructor(...a: ConstructorParameters<typeof Worker>) {
          super(...a)
          this.addEventListener('message', e => {
            if (e.data?.message === 'error') {
              console.error(
                `worker boot failed: ${e.data.error?.message ?? e.data.error}`,
              )
            }
          })
        }
      }
    },
    settings,
    vault,
  )
  const before = Date.now()
  const startedBefore = stats.started
  const toolsBefore = stats.toolLog.length
  const inBefore = stats.inputTokens
  const outBefore = stats.outputTokens
  let answer = ''
  let error = ''
  const work = stageWork(task)
  try {
    await page.goto(`${bridge.url}?config=${await configFor(task)}`)
    page
      .waitForSelector('::-p-text(Yes, I trust it)', { timeout: 60_000 })
      .then(button => button?.click())
      .catch(() => {})
    await bridge.waitForPage(90_000, before)
    await evaluateLive(
      `for (let i = 0; i < 400 && !window.jb; i++) { await new Promise(r => setTimeout(r, 250)) }
       if (!window.jb) { throw new Error('window.jb never appeared') }
       return true`,
      110_000,
    )
    if (!task.config) {
      await evaluateLive(BASELINE_SPEC, 120_000)
    }
    if (task.setup) {
      await evaluateLive(task.setup, 120_000)
    }
    await evaluateLive(
      `const w = session.addWidget('ChatbotWidget', 'JBrowseAssistant')
       session.showWidget(w)
       return true`,
      30_000,
    )
    if (solutions) {
      const solved = await evaluateLive(task.solution ?? 'return ""', 120_000)
      answer = typeof solved === 'string' ? solved : ''
      await sleep(5000)
    } else {
      const input = await page.waitForSelector(
        'textarea[aria-label="Message input"]',
        { timeout: 45_000 },
      )
      await input!.type(task.prompt.replaceAll('WORK', work))
      await page.click('button[aria-label="Send message"]')
      const sentAt = Date.now()
      const profileTimer = profileStalls
        ? setTimeout(() => {
            profilePage(page).catch((e: unknown) => {
              console.log('profile failed', String(e))
            })
          }, 60_000)
        : undefined
      while (Date.now() - sentAt < waitMs) {
        await sleep(1000)
        const pw = await page.$('input[type="password"]')
        if (pw) {
          await pw.type(PASSWORD)
          await page.keyboard.press('Enter')
          continue
        }
        const generating = await page.$('button[aria-label="Stop generating"]')
        const idle = stats.active === 0 && Date.now() - stats.lastEnd > 4000
        if (stats.started > startedBefore && !generating && idle) {
          break
        }
      }
      clearTimeout(profileTimer)
      answer = await page.$$eval(
        '[data-role="assistant"]',
        els => (els.at(-1) as HTMLElement | undefined)?.innerText ?? '',
      )
      if (!answer) {
        error = await page.evaluate(() => document.body.innerText.slice(-700))
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  let verdict: { pass: boolean; detail: unknown }
  try {
    if (task.check) {
      verdict = task.check({ answer, work })
    } else {
      const graded = (await evaluateLive(task.grade!, 60_000, answer)) as {
        pass?: boolean
        detail?: unknown
      } | null
      verdict = { pass: graded?.pass === true, detail: graded?.detail }
    }
  } catch (e) {
    verdict = {
      pass: false,
      detail: `grader threw: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
  const notDrawn = task.grade
    ? await evaluateLive(NOT_DRAWN, 40_000).catch((e: unknown) => [
        { trackId: '?', phase: 'unread', reason: String(e).slice(0, 200) },
      ])
    : []
  await context.close().catch(() => {})
  const inputTokens = stats.inputTokens - inBefore
  const outputTokens = stats.outputTokens - outBefore
  const row = {
    task: task.name,
    run,
    ...verdict,
    notDrawn,
    answer,
    error,
    calls: stats.started - startedBefore,
    inputTokens,
    outputTokens,
    usd: Number((inputTokens * priceIn + outputTokens * priceOut).toFixed(3)),
    seconds: Math.round((Date.now() - before) / 1000),
    attempt,
    tools: stats.toolLog.slice(toolsBefore).map(t => t.slice(0, 300)),
    pageLog: pageLog.slice(-25),
    streamedTextTail: stats.textTail,
    pageClosed: page.isClosed(),
    finalUrl: page.isClosed() ? '' : page.url().slice(0, 120),
  }
  fs.writeFileSync(
    path.join(outDir, `${task.name}-${run}.json`),
    JSON.stringify(
      { task: { name: task.name, prompt: task.prompt }, row },
      null,
      2,
    ),
  )
  const stalled =
    !answer &&
    /timed out|no page carrying/.test(
      `${error} ${JSON.stringify(verdict.detail)}`,
    )
  if (!(stalled && attempt === 1 && retries)) {
    rows.push({ task: task.name, run, pass: row.pass })
  }
  console.log(
    `${row.pass ? 'pass' : 'FAIL'}  ${task.name.padEnd(28)} calls=${row.calls} in=${inputTokens} out=${outputTokens} ${row.seconds}s ~$${row.usd}  total ~$${spend().toFixed(2)}`,
  )
  return { answer, stalled }
}

try {
  outer: for (const task of tasks) {
    for (let run = 1; run <= runs; run++) {
      if (spend() >= budget) {
        console.log(`stopped: estimated spend passed $${budget}`)
        break outer
      }
      const guarded = async (attempt: number) => {
        try {
          return await runOnce(task, run, attempt)
        } catch (e) {
          console.log(`browser lost on ${task.name}: ${String(e).slice(0, 80)}`)
          await browser.close().catch(() => {})
          browser = await launchBrowser()
          rows.push({ task: task.name, run, pass: false })
          fs.writeFileSync(
            path.join(outDir, `${task.name}-${run}.json`),
            JSON.stringify(
              {
                task: { name: task.name, prompt: task.prompt },
                row: {
                  task: task.name,
                  run,
                  pass: false,
                  detail: 'the browser crashed during the run',
                  answer: '',
                  error: String(e).slice(0, 300),
                  inputTokens: 0,
                  outputTokens: 0,
                  attempt,
                },
              },
              null,
              2,
            ),
          )
          return { answer: '', stalled: false }
        }
      }
      let result = await guarded(1)
      if (result.stalled && retries) {
        console.log(`stalled: ${task.name}; retrying once`)
        result = await guarded(2)
      }
      const answer = result.answer
      if (/credit balance|insufficient|billing/i.test(answer)) {
        console.log('stopped: the API reports a credit or billing problem')
        break outer
      }
    }
  }
} finally {
  const passed = rows.filter(r => r.pass).length
  fs.writeFileSync(
    path.join(outDir, 'summary.json'),
    JSON.stringify(
      {
        commit,
        client: 'chat-plugin',
        provider,
        model,
        set: taskSet,
        runs,
        passed,
        total: rows.length,
        estimatedUsd: Number(spend().toFixed(2)),
        budget,
      },
      null,
      2,
    ),
  )
  console.log(
    `\n${passed}/${rows.length} passed; estimated spend $${spend().toFixed(2)}`,
  )
  console.log(`results: ${outDir}`)
  await browser.close()
  proxy.close()
  staticServer.close()
  bridge.close()
}
