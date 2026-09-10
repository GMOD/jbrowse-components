import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

import { ipcHandle, ipcSend } from '../ipc/channels.ts'
import { isAutosave } from '../paths.ts'
import {
  CODE_TIMEOUT_DEFAULT_MS,
  CODE_TIMEOUT_MAX_MS,
  OPEN_SETTLE_MS,
  OPEN_WAIT_MS,
  RENDERER_TIMEOUT_MS,
  relayBudget,
} from './budgets.ts'
import { hostedConfigUrl } from './hostedConfig.ts'
import { onJsonLines, writeJsonLine } from './jsonLines.ts'
import { createScreenshotTool } from './screenshot.ts'
import { defaultSocketPath, ensureSocketDir } from './socketPath.ts'
import { resultFields } from './stdioServer.ts'

import type {
  LaunchTarget,
  McpReadyState,
  RecentSession,
} from '../ipc/channelTypes.ts'
import type { AppPaths } from '../paths.ts'
import type { BridgeToolResult } from './stdioServer.ts'
import type { MainToolName, RendererToolName } from './toolDefinitions.ts'
import type { BrowserWindow } from 'electron'

// How long a relay waits for the renderer to subscribe. Must stay well under
// OPEN_WAIT_MS: openAndWait polls in a loop, and a single wait longer than its
// deadline would let the loop exit having polled exactly once.
const READY_WAIT_MS = 20_000

const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * One call on the socket, addressed in its own connection's id namespace.
 *
 * `call` is this one; `sibling` names another of the same connection's, which
 * is the only thing a cancel is allowed to reach.
 */
interface Caller {
  call: string
  sibling: (requestId: number) => string
}

interface BridgeDeps {
  paths: AppPaths
  appVersion: string
  // injectable so a test can serve its own rendezvous rather than the running
  // app's; nothing but a test passes one
  socketPath?: string
  getWindow: () => BrowserWindow | null
  // ensureWindow, not the link-confirming openTarget: the consent the dialog
  // asks for is given by configuring the MCP client, and a per-call native
  // modal would deadlock an unattended agent
  openTarget: (target: LaunchTarget) => Promise<unknown>
}

export function startMcpBridge({
  paths,
  appVersion,
  socketPath: givenSocketPath,
  getWindow,
  openTarget,
}: BridgeDeps) {
  // The default rendezvous is the one this has to vouch for — a directory this
  // account exclusively owns, since the endpoint runs arbitrary code. A caller
  // that names its own path owns its own directory.
  if (givenSocketPath === undefined) {
    ensureSocketDir()
  }
  const socketPath = givenSocketPath ?? defaultSocketPath()
  let relayId = 0
  const relays = new Map<number, (response: BridgeToolResult) => void>()

  ipcHandle('mcpResponse', (_event, response) => {
    const settle = relays.get(response.id)
    if (settle) {
      relays.delete(response.id)
      settle({ result: response.result, error: response.error })
    }
  })

  // A window exists well before its page subscribes to mcpRequest, and
  // webContents.send to a page with no listener is discarded with no queue and
  // no retry — so a push issued in that gap costs the whole relay timeout and
  // answers nothing. The renderer says when it is listening; relays wait here.
  let listening: McpReadyState | undefined
  let waiters: (() => void)[] = []

  ipcHandle('mcpReady', (_event, state) => {
    listening = state
    const pending = waiters
    waiters = []
    for (const wake of pending) {
      wake()
    }
  })

  // Nothing is coming for these, so waiting out RENDERER_TIMEOUT_MS is a 150s
  // hang over a call that is already unanswerable — which is what a screenshot
  // taken across a navigation used to cost.
  function settleOrphans(error: string) {
    const orphaned = [...relays.values()]
    relays.clear()
    for (const settle of orphaned) {
      settle({ error })
    }
  }

  function stopListening() {
    listening = undefined
    settleOrphans('the page reloaded before the app answered; try again')
  }

  // A page load tears the subscription down without telling anyone, so the
  // bridge has to notice for itself or it would keep trusting the outgoing
  // page's announcement. Attached per window, once.
  // A window in the background has its timers throttled to one tick a second,
  // which is the rate the settle poll and the rAF that publishes a view's
  // width then run at. An app with an agent on the socket is in use whichever
  // window is in front, so throttling is off for as long as a client is
  // connected. This is the timer half only: a window another window fully
  // covers stops rendering altogether, and that is the
  // disable-backgrounding-occluded-windows switch in electron.ts. The
  // screenshot path below still toggles throttling around a capture for a
  // client that connected before a window existed.
  let connectedClients = 0
  function applyThrottling() {
    getWindow()?.webContents.setBackgroundThrottling(connectedClients === 0)
  }

  let watchedContents: number | undefined
  function watchWindow() {
    const win = getWindow()
    if (!win || win.webContents.id === watchedContents) {
      return
    }
    watchedContents = win.webContents.id
    applyThrottling()
    // did-start-navigation, not did-start-loading: the latter also toggles for
    // load activity that leaves the subscription intact, and clearing on it
    // made every relay pay the ready wait on a busy page
    win.webContents.on('did-start-navigation', details => {
      if (details.isMainFrame && !details.isSameDocument) {
        stopListening()
      }
    })
    win.webContents.on('destroyed', stopListening)
  }

  async function awaitListening(timeoutMs: number) {
    if (listening) {
      return true
    }
    return new Promise<boolean>(resolve => {
      const wake = () => {
        clearTimeout(timer)
        resolve(true)
      }
      const timer = setTimeout(() => {
        waiters = waiters.filter(w => w !== wake)
        resolve(false)
      }, timeoutMs)
      waiters.push(wake)
    })
  }

  // The relay a socket request is waiting on, so `cancel` can name the running
  // code. The client's own request id addresses it — the ids the bridge hands
  // the renderer are its own and a client cannot know them — but every client
  // numbers its calls from zero, so the connection is half the key. Two on the
  // socket at once (Claude Desktop beside Claude Code) both have a call 5, and
  // a cancel from one would otherwise abort the other's.
  const relayForRequest = new Map<string, number>()

  async function relayToRenderer(
    tool: string,
    args: Record<string, unknown>,
    timeoutMs = RENDERER_TIMEOUT_MS,
    requestId?: string,
  ): Promise<BridgeToolResult> {
    if (!getWindow()) {
      return {
        error:
          'JBrowse Desktop has no window open. Use the open tool or launch a session first.',
      }
    }
    watchWindow()
    // Answering fast beats sending into the void: a push to a page that has not
    // subscribed is discarded silently, so proceeding anyway would buy nothing
    // and cost the whole relay timeout. The caller can retry cheaply.
    if (!(await awaitListening(Math.min(timeoutMs, READY_WAIT_MS)))) {
      return { error: `the app was still loading when "${tool}" was sent` }
    }
    const win = getWindow()
    if (!win) {
      return { error: 'JBrowse Desktop has no window open' }
    }
    const id = relayId++
    if (requestId !== undefined) {
      relayForRequest.set(requestId, id)
    }
    try {
      return await new Promise<BridgeToolResult>(resolve => {
        const timer = setTimeout(() => {
          relays.delete(id)
          resolve({ error: `The app did not answer "${tool}" in time` })
        }, timeoutMs)
        relays.set(id, response => {
          clearTimeout(timer)
          resolve(response)
        })
        ipcSend(win.webContents, 'mcpRequest', { id, tool, args })
      })
    } finally {
      if (requestId !== undefined) {
        relayForRequest.delete(requestId)
      }
    }
  }

  // The client gave up on a call — an interrupted agent, almost always. The
  // code is cooperative, so aborting its `signal` is the whole remedy: without
  // it a runaway loop kept the renderer pinned for the rest of its budget with
  // nobody left to read the answer. A connection can only cancel its own calls,
  // which is what `sibling` means.
  function cancelTool(args: Record<string, unknown>, caller: Caller) {
    const requestId = typeof args.id === 'number' ? args.id : undefined
    const relay =
      requestId === undefined
        ? undefined
        : relayForRequest.get(caller.sibling(requestId))
    return relay === undefined
      ? Promise.resolve({ result: { cancelled: false } })
      : relayToRenderer('cancel', { id: relay }, 5000)
  }

  async function listRecentSessions(): Promise<BridgeToolResult> {
    let sessions: RecentSession[] = []
    try {
      sessions = JSON.parse(
        await fs.promises.readFile(paths.recentSessionsPath, 'utf8'),
      ) as RecentSession[]
    } catch {
      // no recent-sessions file yet
    }
    return {
      result: sessions.map(s => ({
        ...s,
        updated: new Date(s.updated).toISOString(),
        isAutosave: isAutosave(paths, s.path),
      })),
    }
  }

  // openTarget resolves when the launch is HANDED OVER (a push, or a page
  // load), not when the new session is up — and a load that fails leaves the
  // old session open by design. Answering then would let the very next call
  // read the previous config's tracks as if they were the new one's, so this
  // waits for the renderer to announce a new install. NOT the session's own id:
  // that is persisted with the session, so reopening a saved one restores the
  // id it was saved under and would never look like a change.
  //
  // A new install id is where the wait STARTS, not where it ends. Loading a
  // link with nothing open navigates the window, and the page that lands
  // announces on mount with an id of its own before it has fetched a byte — so
  // the id alone answered every agent's first `open` in a quarter second, with
  // a blank app and `settled: true`. The phase is what says the session
  // arrived, and it says so for the load that failed too.
  async function openAndWait(
    target: Parameters<BridgeDeps['openTarget']>[0],
    opened: string,
  ): Promise<BridgeToolResult> {
    watchWindow()
    const before = listening?.install
    const failedBefore = listening?.launchError?.attempt ?? 0
    await openTarget(target)
    const deadline = Date.now() + OPEN_WAIT_MS
    while (Date.now() < deadline) {
      watchWindow()
      const failed = listening?.launchError
      if (failed && failed.attempt > failedBefore) {
        return {
          error: `${opened} did not load: ${failed.message}. The session that was open is still open.`,
        }
      }
      if (listening && listening.install !== before) {
        if (listening.phase === 'startScreen') {
          return {
            error: `${opened} did not load — the app fell back to the start screen. Its error notification says why.`,
          }
        }
        if (listening.phase === 'session') {
          // the first call every agent makes: a cold volvox load on a busy
          // machine passed 30s and answered settled:false over a session that
          // was fine, and the loop below exits the moment it is ready anyway
          const settled = await relayToRenderer(
            'wait_ready',
            { timeoutMs: OPEN_SETTLE_MS },
            relayBudget(OPEN_SETTLE_MS),
          )
          // the relay's own failure, not the settle's: dropping it answered a
          // reloaded page with a bare { opened } that carried no `settled` and
          // no reason, which reads as success
          return {
            result: {
              opened,
              ...(settled.error
                ? { warning: settled.error }
                : resultFields(settled.result)),
            },
          }
        }
      }
      await delay(250)
    }
    return {
      result: {
        opened,
        note: 'the session had not finished loading (or the load failed and the previous session is still open) — check with inspect via run_javascript',
      },
    }
  }

  async function openTool(
    args: Record<string, unknown>,
  ): Promise<BridgeToolResult> {
    const target = typeof args.target === 'string' ? args.target : ''
    if (!target) {
      return listRecentSessions()
    }
    if (/^https?:\/\//.test(target)) {
      return openAndWait({ type: 'link', url: target }, target)
    }
    if (!path.isAbsolute(target)) {
      const hosted = hostedConfigUrl(target)
      return {
        error: `"${target}" is a relative path, which would resolve against the app's working directory (${process.cwd()}), not yours — pass an absolute path or a URL.${
          hosted
            ? ` For the hosted genome of that name: ${hosted}`
            : ' For a hosted genome, docs topic "hosted-data" has the config URL for any UCSC database or GenArk accession.'
        }`,
      }
    }
    if (!fs.existsSync(target)) {
      return { error: `No such file: ${target}` }
    }
    return openAndWait({ type: 'file', path: target }, target)
  }

  // budgeted past the code's own deadline, so the renderer's answer (the error
  // with the console output so far) wins over the relay's silence
  function codeRelayBudget(args: Record<string, unknown>) {
    return relayBudget(
      Math.min(
        typeof args.timeoutMs === 'number'
          ? args.timeoutMs
          : CODE_TIMEOUT_DEFAULT_MS,
        CODE_TIMEOUT_MAX_MS,
      ),
    )
  }

  // One table, so `handledBy` routes rather than being read and then switched
  // on again — and the annotation is what makes it load-bearing: a tool
  // declared `main` or `renderer` and served nowhere fails the build here,
  // rather than answering "Unknown tool" to a client tools/list had just
  // advertised it to. A tool the stdio server answers for itself (docs) is
  // deliberately absent, and reaches the socket only from a client that made
  // the name up. `app_version` and `cancel` are the two wire verbs no client
  // asks for by name.
  const handlers: Record<
    MainToolName | RendererToolName | 'app_version' | 'cancel',
    (args: Record<string, unknown>, caller: Caller) => Promise<BridgeToolResult>
  > = {
    // the stdio server compares this against its own version so the docs it
    // bundles can say when they describe a different build than the one running
    app_version: () => Promise.resolve({ result: { version: appVersion } }),
    cancel: cancelTool,
    open: openTool,
    screenshot: createScreenshotTool({ getWindow, relay: relayToRenderer }),
    run_javascript: (args, caller) =>
      relayToRenderer(
        'run_javascript',
        args,
        codeRelayBudget(args),
        caller.call,
      ),
  }

  async function dispatch(
    tool: string,
    args: Record<string, unknown>,
    caller: Caller,
  ): Promise<BridgeToolResult> {
    const handler = (handlers as Record<string, (typeof handlers)['open']>)[
      tool
    ]
    return handler?.(args, caller) ?? { error: `Unknown tool: ${tool}` }
  }

  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    // a leftover from a crashed instance; the single-instance lock says no
    // other live one holds it
    fs.unlinkSync(socketPath)
  }

  let connectionId = 0
  const server = net.createServer(socket => {
    const connection = connectionId++
    const sibling = (requestId: number) => `${connection}:${requestId}`
    connectedClients += 1
    applyThrottling()
    socket.on('close', () => {
      connectedClients -= 1
      applyThrottling()
    })
    // Everything in here runs in the MAIN process, where an uncaught throw
    // takes the app down with the user's unsaved session — so the whole body is
    // guarded, on top of what onJsonLines already refuses. A line with no
    // numeric id has nobody to answer: the client matches responses by id and
    // would leave the reply pending, so that one is dropped.
    onJsonLines(socket, line => {
      try {
        if (!('value' in line)) {
          return
        }
        const request = line.value as {
          id?: unknown
          tool?: unknown
          args?: unknown
        }
        if (typeof request.id !== 'number') {
          return
        }
        const { id } = request
        const answer = (outcome: BridgeToolResult) => {
          writeJsonLine(socket, { id, ...outcome })
        }
        if (typeof request.tool !== 'string') {
          answer({ error: 'Invalid request: "tool" must be a string' })
          return
        }
        const args =
          typeof request.args === 'object' &&
          request.args !== null &&
          !Array.isArray(request.args)
            ? (request.args as Record<string, unknown>)
            : {}
        void dispatch(request.tool, args, { call: sibling(id), sibling })
          .catch((e: unknown) => ({ error: String(e) }))
          .then(answer)
      } catch (e) {
        console.error('MCP bridge dropped a malformed line:', e)
      }
    })
  })
  server.on('error', (e: Error) => {
    console.error('MCP bridge failed to listen:', e)
  })
  server.listen(socketPath)

  return () => {
    server.close()
    // Answering beats silence: a client waiting on a relay when the app quits
    // would otherwise sit out its own timeout for a call nobody is left to run.
    // It is also what lets the relay timers go, which is how a test that starts
    // a bridge stops holding its worker open.
    settleOrphans('JBrowse Desktop is shutting down')
    if (process.platform !== 'win32') {
      fs.rmSync(socketPath, { force: true })
    }
  }
}
