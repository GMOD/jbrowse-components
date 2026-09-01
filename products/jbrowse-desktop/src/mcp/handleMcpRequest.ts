import {
  createJbApi,
  ensureReExports,
  safeJson,
  sessionOf,
  undeliveredNotifications,
  waitReady,
} from '@jbrowse/app-core'

import {
  CODE_TIMEOUT_DEFAULT_MS,
  CODE_TIMEOUT_MAX_MS,
} from '../../electron/mcp/toolDefinitions.ts'

import type { McpBridgeRequest } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'

// The raw primitive under all of the above: Claude-authored code against the
// live model graph. The renderer already runs with nodeIntegration and the
// bridge socket is user-only, so this grants what the surface as a whole
// already grants — expressed directly instead of through a curated verb.
//
// What the code is given — the `jb` standard library — lives in
// @jbrowse/app-core, because jbrowse-web publishes the same object as
// `window.jb`. Only the calling convention and the response envelope are here.

// `new Function` wraps its body in two header lines, and the async wrapper
// below adds one more, so line 1 of the submitted code is line 4 to V8.
const CODE_LINE_OFFSET = 3
const LOG_ENTRY_MAX_CHARS = 2000
const LOG_ENTRIES_MAX = 200

type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

function formatLogArg(arg: unknown) {
  return typeof arg === 'string'
    ? arg
    : arg instanceof Error
      ? `${arg.name}: ${arg.message}`
      : safeJson(arg)
}

// Shadows the global `console` inside the submitted code only: the real one
// still gets every call (devtools keep working), and the agent gets back the
// stdout it would have had from a shell.
export function captureConsole(logs: string[]) {
  const record = (level: ConsoleLevel, args: unknown[]) => {
    if (logs.length < LOG_ENTRIES_MAX) {
      const line = args.map(a => formatLogArg(a)).join(' ')
      const clipped =
        line.length > LOG_ENTRY_MAX_CHARS
          ? `${line.slice(0, LOG_ENTRY_MAX_CHARS)}… (${line.length} chars)`
          : line
      logs.push(level === 'log' ? clipped : `[${level}] ${clipped}`)
    } else if (logs.length === LOG_ENTRIES_MAX) {
      logs.push(`… console output after ${LOG_ENTRIES_MAX} entries dropped`)
    }
  }
  const forward =
    (level: ConsoleLevel) =>
    (...args: unknown[]) => {
      console[level](...args)
      record(level, args)
    }
  return Object.assign(Object.create(console) as Console, {
    log: forward('log'),
    info: forward('info'),
    warn: forward('warn'),
    error: forward('error'),
    debug: forward('debug'),
  })
}

export function codePositions(stack: string) {
  return [...stack.matchAll(/<anonymous>:(\d+):(\d+)/g)]
    .map(m => ({ line: Number(m[1]) - CODE_LINE_OFFSET, column: Number(m[2]) }))
    .filter(p => p.line >= 1)
}

class CodeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `the code did not finish within ${timeoutMs} ms and is still running in the app. For a long job: start it, keep its promise on globalThis, return at once, and await that promise from a later call (the live-model guide shows the idiom). Raise timeoutMs only for work that has to block.`,
    )
    this.name = 'CodeTimeoutError'
  }
}

// What the agent reads on a failing call: the error, where in ITS code it was
// thrown (V8 numbers lines from the wrapper, which is why the rebasing), and
// everything the code printed first — the message alone left it editing a
// sixty-line script blind.
export function codeErrorMessage(e: unknown, logs: string[]) {
  const head = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  const positions =
    e instanceof Error && e.stack && !(e instanceof CodeTimeoutError)
      ? codePositions(e.stack)
      : []
  const where =
    positions.length > 0
      ? `\n    at code line ${positions[0]!.line}, column ${positions[0]!.column}`
      : ''
  const output =
    logs.length > 0
      ? `\nconsole output before the error:\n${logs.join('\n')}`
      : ''
  return `${head}${where}${output}`
}

function compileCode(code: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function(
      'session',
      'rootModel',
      'pluginManager',
      'jb',
      'console',
      `return (async () => {\n${code}\n})()`,
    ) as (
      session: AbstractSessionModel,
      rootModel: unknown,
      pluginManager: PluginManager,
      jbHelpers: ReturnType<typeof createJbApi>,
      capturedConsole: Console,
    ) => Promise<unknown>
  } catch (e) {
    throw new Error(
      `${e instanceof Error ? `${e.name}: ${e.message}` : String(e)} — the code did not compile. V8 reports no line for a function body: look for an unbalanced bracket or quote, an "await" inside a non-async callback, or a stray "return" at the top of a loop body.`,
      { cause: e },
    )
  }
}

function clampTimeout(requested: unknown) {
  const ms = typeof requested === 'number' ? requested : CODE_TIMEOUT_DEFAULT_MS
  return Math.min(Math.max(ms, 1000), CODE_TIMEOUT_MAX_MS)
}

async function runWithTimeout<T>(work: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new CodeTimeoutError(timeoutMs))
    }, timeoutMs)
  })
  try {
    return await Promise.race([work, expiry])
  } finally {
    clearTimeout(timer)
  }
}

async function evaluate(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  await ensureReExports()
  const code = typeof args.code === 'string' ? args.code : ''
  if (!code) {
    throw new Error('run_javascript needs code (an async function body)')
  }
  const maxBytes = typeof args.maxBytes === 'number' ? args.maxBytes : 50_000
  const timeoutMs = clampTimeout(args.timeoutMs)
  const jb = createJbApi(pluginManager)
  const fn = compileCode(code)
  const logs: string[] = []
  let value: unknown
  try {
    value = await runWithTimeout(
      fn(
        session,
        pluginManager.rootModel,
        pluginManager,
        jb,
        captureConsole(logs),
      ),
      timeoutMs,
    )
  } catch (e) {
    throw new Error(codeErrorMessage(e, logs), { cause: e })
  }
  // read after the code ran: loadSessionSpec inside it replaces the session
  const liveSession = sessionOf(pluginManager)
  const notifications = liveSession ? undeliveredNotifications(liveSession) : []
  const extras = {
    ...(logs.length > 0 ? { logs } : {}),
    ...(notifications.length > 0 ? { notifications } : {}),
  }
  if (value === undefined) {
    return {
      note: 'code returned undefined — use "return" for a value',
      ...extras,
    }
  }
  // Past V8's maximum string, JSON.stringify throws RangeError("Invalid string
  // length") rather than returning something long — so the truncation below
  // never gets the chance to help with the case it exists for, and the caller
  // is told about string lengths when what it did was return a live object.
  let json
  try {
    json = safeJson(value)
  } catch (e) {
    throw new Error(
      codeErrorMessage(
        new Error(
          `the returned value could not be serialized (${e instanceof Error ? e.message : String(e)}). A live model node or a rendering backend serializes its whole object graph — return a summary you built from it instead of the object.`,
        ),
        logs,
      ),
      { cause: e },
    )
  }
  return json.length <= maxBytes
    ? { bytes: json.length, value: JSON.parse(json) as unknown, ...extras }
    : {
        bytes: json.length,
        note: `result larger than maxBytes=${maxBytes} — truncated preview follows; aggregate in code or raise maxBytes`,
        preview: json.slice(0, maxBytes),
        ...extras,
      }
}

export async function handleMcpRequest(
  request: McpBridgeRequest,
  pluginManager: PluginManager | undefined,
): Promise<unknown> {
  const { tool, args } = request
  const session = sessionOf(pluginManager)
  if (tool === 'wait_ready') {
    return session
      ? waitReady(
          typeof args.timeoutMs === 'number' ? args.timeoutMs : 30_000,
          session,
        )
      : { settled: true, note: 'no session is open (start screen)' }
  }
  // the crop box for a screenshot: pixels are the main process's, but where a
  // view sits on the page is only known here
  if (tool === 'measure') {
    const selector = typeof args.selector === 'string' ? args.selector : ''
    const element = document.querySelector(selector)
    if (!element) {
      throw new Error(
        `nothing on the page matches "${selector}" — a view's element is [data-testid="view-container-<view.id>"]`,
      )
    }
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }
  if (!pluginManager || !session) {
    throw new Error(
      'No session is open. Use the open tool with a config/session file or URL, or bare to list recent sessions.',
    )
  }
  if (tool === 'run_javascript') {
    return evaluate(pluginManager, session, args)
  }
  throw new Error(`Unknown tool: ${tool} — use run_javascript`)
}
