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
} from '../../electron/mcp/budgets.ts'
import { drainPageErrors } from './pageErrors.ts'

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
// The envelope's own ceiling. maxBytes bounds the returned value, and the logs
// rode beside it bounded only by the entry count — so one console.log of a
// large object inside a loop answered a 50 KB-capped call with 400 KB.
const LOG_TOTAL_MAX_CHARS = 20_000

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
  let chars = 0
  let stopped = false
  const record = (level: ConsoleLevel, args: unknown[]) => {
    if (stopped) {
      return
    }
    if (logs.length >= LOG_ENTRIES_MAX || chars >= LOG_TOTAL_MAX_CHARS) {
      stopped = true
      logs.push(
        `… console output dropped after ${logs.length} entries and ${chars} chars — aggregate before printing`,
      )
      return
    }
    const line = args.map(a => formatLogArg(a)).join(' ')
    const clipped =
      line.length > LOG_ENTRY_MAX_CHARS
        ? `${line.slice(0, LOG_ENTRY_MAX_CHARS)}… (${line.length} chars)`
        : line
    const entry = level === 'log' ? clipped : `[${level}] ${clipped}`
    chars += entry.length
    logs.push(entry)
  }
  const forward =
    (level: ConsoleLevel) =>
    (...args: unknown[]) => {
      // eslint-disable-next-line no-console -- level is dynamic, not statically 'log'/'info'/'debug'
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

// The two ways a call stops without the submitted code throwing: its own
// deadline, and a client that gave up. Neither has a line in that code to name.
class CodeHalted extends Error {}

class CodeTimeoutError extends CodeHalted {
  constructor(timeoutMs: number) {
    super(
      `the code did not finish within ${timeoutMs} ms and is still running in the app — its "signal" argument is now aborted, so work that checks it stops. For a long job: start it, keep its promise on globalThis, return at once, and await that promise from a later call (the live-model guide shows the idiom). Raise timeoutMs only for work that has to block.`,
    )
    this.name = 'CodeTimeoutError'
  }
}

class CodeCancelledError extends CodeHalted {
  constructor() {
    super(
      'the client cancelled this call; its "signal" argument is aborted, so cooperative work has stopped',
    )
    this.name = 'CodeCancelledError'
  }
}

// What the agent reads on a failing call: the error, where in ITS code it was
// thrown (V8 numbers lines from the wrapper, which is why the rebasing), and
// everything the code printed first — the message alone left it editing a
// sixty-line script blind.
export function codeErrorMessage(e: unknown, logs: string[]) {
  const head = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  const positions =
    e instanceof Error && e.stack && !(e instanceof CodeHalted)
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
      'signal',
      `return (async () => {\n${code}\n})()`,
    ) as (
      session: AbstractSessionModel | undefined,
      rootModel: unknown,
      pluginManager: PluginManager,
      jbHelpers: ReturnType<typeof createJbApi>,
      capturedConsole: Console,
      signal: AbortSignal,
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

function haltReason(signal: AbortSignal) {
  return signal.reason instanceof CodeHalted
    ? signal.reason
    : new CodeCancelledError()
}

/**
 * Run the code until it finishes, its deadline passes, or the client gives up.
 *
 * The code itself is only ever cooperative — nothing can unwind a running
 * function body — so both halts abort `signal` and then stop WAITING, which is
 * what frees the relay a call nobody is listening to used to hold for the rest
 * of its budget.
 *
 * A thunk rather than a promise, and the aborted check before it: a cancel that
 * lands while the re-export registry is still importing fires against a signal
 * nobody is listening to yet, and the listener below would then never see an
 * event. That left the call waiting out its whole timeout — the one thing
 * cancelling is for.
 */
async function runUntilHalted<T>(
  start: () => Promise<T>,
  timeoutMs: number,
  abort: AbortController,
) {
  if (abort.signal.aborted) {
    throw haltReason(abort.signal)
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const halt = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      abort.abort(new CodeTimeoutError(timeoutMs))
    }, timeoutMs)
    abort.signal.addEventListener(
      'abort',
      () => {
        reject(haltReason(abort.signal))
      },
      { once: true },
    )
  })
  try {
    return await Promise.race([start(), halt])
  } finally {
    clearTimeout(timer)
  }
}

// The evaluations in flight, so `cancel` can reach the one a client gave up on.
// Keyed by the bridge's own request id, which is what the cancel carries.
const running = new Map<number, AbortController>()

// Registered before the first await, so a cancel that lands while the
// re-export registry is still loading reaches the call rather than missing it.
async function evaluate(
  pluginManager: PluginManager,
  session: AbstractSessionModel | undefined,
  args: Record<string, unknown>,
  id: number,
) {
  // aborted when timeoutMs expires or the client cancels: a deadline that only
  // stopped the ANSWER left a runaway loop pinning the renderer with no remedy
  // short of restarting the app — cooperative code that checks `signal` stops
  const abort = new AbortController()
  running.set(id, abort)
  try {
    return await evaluateWith(pluginManager, session, args, abort)
  } finally {
    running.delete(id)
  }
}

// `session` is undefined on the start screen. The code still runs: jb.
// loadSessionSpec builds a session out of the plugin manager alone, and
// refusing to execute until one exists made the one helper that can bootstrap
// a session the one thing you could not reach.
async function evaluateWith(
  pluginManager: PluginManager,
  session: AbstractSessionModel | undefined,
  args: Record<string, unknown>,
  abort: AbortController,
) {
  await ensureReExports()
  const code = typeof args.code === 'string' ? args.code : ''
  if (!code) {
    throw new Error('run_javascript needs code (an async function body)')
  }
  const maxBytes = typeof args.maxBytes === 'number' ? args.maxBytes : 50_000
  const timeoutMs = clampTimeout(args.timeoutMs)
  // A toast is delivered once, by identity, and a settle is what consumes it —
  // so `await jb.waitReady(...)` inside the code took the notifications this
  // envelope promises to carry, and returning anything but the settle dropped
  // them. Collected here and merged below, so it does not matter which of the
  // two read them first.
  const consumed: { level: string; message: string }[] = []
  const jb = createJbApi(pluginManager, {
    onNotifications: messages => {
      consumed.push(...messages)
    },
  })
  const fn = compileCode(code)
  const logs: string[] = []
  let value: unknown
  try {
    value = await runUntilHalted(
      () =>
        fn(
          session,
          pluginManager.rootModel,
          pluginManager,
          jb,
          captureConsole(logs),
          abort.signal,
        ),
      timeoutMs,
      abort,
    )
  } catch (e) {
    throw new Error(codeErrorMessage(e, logs), { cause: e })
  }
  // read after the code ran: loadSessionSpec inside it replaces the session
  const liveSession = sessionOf(pluginManager)
  const notifications = [
    ...consumed,
    ...(liveSession ? undeliveredNotifications(liveSession) : []),
  ]
  const pageErrors = drainPageErrors()
  const extras = {
    ...(logs.length > 0 ? { logs } : {}),
    ...(notifications.length > 0 ? { notifications } : {}),
    ...(pageErrors.length > 0 ? { pageErrors } : {}),
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

// the crop box for a screenshot: pixels are the main process's, but where a
// view sits on the page is only known here
function measure(args: Record<string, unknown>) {
  const selector = typeof args.selector === 'string' ? args.selector : ''
  const element = document.querySelector(selector)
  if (!element) {
    throw new Error(
      `nothing on the page matches "${selector}" — a view's element is [data-testid="view-container-<view.id>"]`,
    )
  }
  const { x, y, width, height } = element.getBoundingClientRect()
  return {
    x,
    y,
    width,
    height,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }
}

// a frame after the DOM settled: rAF fires in a hidden page only while the
// bridge has throttling off, which is exactly the window this is called in
async function paint() {
  const painted = await new Promise<boolean>(resolve => {
    const timer = setTimeout(() => {
      resolve(false)
    }, 5000)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clearTimeout(timer)
        resolve(true)
      })
    })
  })
  return { hidden: document.hidden, painted }
}

function cancelRunning(args: Record<string, unknown>) {
  const id = typeof args.id === 'number' ? args.id : undefined
  const abort = id === undefined ? undefined : running.get(id)
  abort?.abort(new CodeCancelledError())
  return { cancelled: abort !== undefined }
}

// What the page answers without a model: the bridge asks for these while taking
// a picture or calling a run off, and the first three have to work on the start
// screen, where no plugin manager is installed at all.
const pageTools: Record<
  string,
  (
    args: Record<string, unknown>,
    session: AbstractSessionModel | undefined,
  ) => unknown
> = {
  // the page's own errors ride the settle, so a screenshot carries them too:
  // the bridge relays wait_ready before every capture
  wait_ready: async (args, session) => {
    const settle = session
      ? await waitReady(
          typeof args.timeoutMs === 'number' ? args.timeoutMs : 30_000,
          session,
        )
      : { settled: true, note: 'no session is open (start screen)' }
    const pageErrors = drainPageErrors()
    return pageErrors.length > 0 ? { ...settle, pageErrors } : settle
  },
  measure,
  paint,
  cancel: cancelRunning,
}

export async function handleMcpRequest(
  request: McpBridgeRequest,
  pluginManager: PluginManager | undefined,
): Promise<unknown> {
  const { tool, args } = request
  const session = sessionOf(pluginManager)
  const page = pageTools[tool]
  if (page) {
    return page(args, session)
  }
  // The start screen installs no plugin manager at all (Loader's
  // replacePluginManager: "undefined installs nothing"), so there is nothing
  // for code to run against and `open` is the only way in. With a manager but
  // no session — a load in flight, or one that failed — the code does run,
  // because jb.loadSessionSpec builds a session out of the manager alone and
  // gating on the session made the one helper that can bootstrap one
  // unreachable.
  if (!pluginManager) {
    throw new Error(
      'No session is open, and the start screen has nothing to run code against. Use the open tool with a config/session file or URL, or bare to list recent sessions.',
    )
  }
  if (tool !== 'run_javascript') {
    throw new Error(`Unknown tool: ${tool} — use run_javascript`)
  }
  return evaluate(pluginManager, session, args, request.id)
}
