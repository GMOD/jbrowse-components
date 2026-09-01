import fs from 'node:fs'
import net from 'node:net'
import readline from 'node:readline'

import { ipcHandle, ipcSend } from '../ipc/channels.ts'
import { isAutosave } from '../paths.ts'
import { defaultSocketPath, ensureSocketDir } from './socketPath.ts'
import { MCP_TOOLS } from './toolDefinitions.ts'

import type {
  LaunchTarget,
  McpReadyState,
  RecentSession,
} from '../ipc/channelTypes.ts'
import type { AppPaths } from '../paths.ts'
import type { BridgeToolResult } from './stdioServer.ts'
import type { BrowserWindow } from 'electron'

const RENDERER_TIMEOUT_MS = 150_000
const SCREENSHOT_WAIT_MS = 30_000
const OPEN_WAIT_MS = 90_000
// How long a relay waits for the renderer to subscribe. Must stay well under
// OPEN_WAIT_MS: openAndWait polls in a loop, and a single wait longer than its
// deadline would let the loop exit having polled exactly once.
const READY_WAIT_MS = 20_000

const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

interface BridgeDeps {
  paths: AppPaths
  getWindow: () => BrowserWindow | null
  // ensureWindow, not the link-confirming openTarget: the consent the dialog
  // asks for is given by configuring the MCP client, and a per-call native
  // modal would deadlock an unattended agent
  openTarget: (target: LaunchTarget) => Promise<unknown>
}

export function startMcpBridge({ paths, getWindow, openTarget }: BridgeDeps) {
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

  function stopListening() {
    listening = undefined
    // The page these were sent to is gone, so no mcpResponse is ever coming.
    // Without this they sit until RENDERER_TIMEOUT_MS — a 150s hang for a call
    // that was already unanswerable, which is what a screenshot taken across a
    // navigation used to cost.
    const orphaned = [...relays.values()]
    relays.clear()
    for (const settle of orphaned) {
      settle({ error: 'the page reloaded before the app answered; try again' })
    }
  }

  // A page load tears the subscription down without telling anyone, so the
  // bridge has to notice for itself or it would keep trusting the outgoing
  // page's announcement. Attached per window, once.
  let watchedContents: number | undefined
  function watchWindow() {
    const win = getWindow()
    if (!win || win.webContents.id === watchedContents) {
      return
    }
    watchedContents = win.webContents.id
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

  async function relayToRenderer(
    tool: string,
    args: Record<string, unknown>,
    timeoutMs = RENDERER_TIMEOUT_MS,
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
    return new Promise(resolve => {
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
    await openTarget(target)
    const deadline = Date.now() + OPEN_WAIT_MS
    while (Date.now() < deadline) {
      watchWindow()
      if (listening && listening.install !== before) {
        if (listening.phase === 'startScreen') {
          return {
            error: `${opened} did not load — the app fell back to the start screen. Its error notification says why.`,
          }
        }
        if (listening.phase === 'session') {
          const settled = await relayToRenderer('wait_ready', {
            timeoutMs: 30_000,
          })
          return {
            result: { opened, ...(settled.result as object | undefined) },
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
    if (!fs.existsSync(target)) {
      return { error: `No such file: ${target}` }
    }
    return openAndWait({ type: 'file', path: target }, target)
  }

  async function screenshot(
    args: Record<string, unknown>,
  ): Promise<BridgeToolResult> {
    // clamped under the relay timeout, which would otherwise fire first and
    // silently convert a long wait into a warning
    const timeoutMs = Math.min(
      typeof args.timeoutMs === 'number' ? args.timeoutMs : SCREENSHOT_WAIT_MS,
      120_000,
    )
    // budget the relay against the wait actually requested: a timeoutMs: 0
    // screenshot must not be able to block for RENDERER_TIMEOUT_MS
    const settled = await relayToRenderer(
      'wait_ready',
      { timeoutMs },
      Math.max(timeoutMs + 15_000, 30_000),
    )
    const win = getWindow()
    if (!win) {
      return { error: 'JBrowse Desktop has no window open' }
    }
    const image = await win.webContents.capturePage()
    return {
      result: settled.error ? { warning: settled.error } : settled.result,
      image: { data: image.toPNG().toString('base64'), mimeType: 'image/png' },
    }
  }

  async function dispatch(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<BridgeToolResult> {
    const definition = MCP_TOOLS.find(t => t.name === tool)
    if (!definition) {
      return { error: `Unknown tool: ${tool}` }
    }
    if (definition.handledBy === 'renderer') {
      return relayToRenderer(tool, args)
    }
    switch (tool) {
      case 'open':
        return openTool(args)
      case 'screenshot':
        return screenshot(args)
      default:
        return { error: `Unhandled tool: ${tool}` }
    }
  }

  ensureSocketDir()
  const socketPath = defaultSocketPath()
  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    // a leftover from a crashed instance; the single-instance lock says no
    // other live one holds it
    fs.unlinkSync(socketPath)
  }

  const server = net.createServer(socket => {
    const rl = readline.createInterface({ input: socket })
    // Everything in here runs in the MAIN process, where an uncaught throw
    // takes the app down with the user's unsaved session — so nothing off the
    // socket is trusted, `null` and arrays included (JSON.parse accepts both),
    // and the whole body is guarded. A line with no numeric id has nobody to
    // answer: the client matches responses by id and would leave the reply
    // pending, so that one is dropped.
    rl.on('line', line => {
      try {
        let parsed: unknown
        try {
          parsed = JSON.parse(line)
        } catch {
          return
        }
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          return
        }
        const request = parsed as {
          id?: unknown
          tool?: unknown
          args?: unknown
        }
        if (typeof request.id !== 'number') {
          return
        }
        const { id } = request
        const answer = (outcome: BridgeToolResult) => {
          if (!socket.destroyed) {
            socket.write(`${JSON.stringify({ id, ...outcome })}\n`)
          }
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
        void dispatch(request.tool, args)
          .catch((e: unknown) => ({ error: String(e) }))
          .then(answer)
      } catch (e) {
        console.error('MCP bridge dropped a malformed line:', e)
      }
    })
    socket.on('error', () => {})
  })
  server.on('error', (e: Error) => {
    console.error('MCP bridge failed to listen:', e)
  })
  server.listen(socketPath)

  return () => {
    server.close()
    if (process.platform !== 'win32') {
      fs.rmSync(socketPath, { force: true })
    }
  }
}
