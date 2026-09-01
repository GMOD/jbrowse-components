import fs from 'node:fs'
import net from 'node:net'
import readline from 'node:readline'

import { ipcHandle, ipcSend } from '../ipc/channels.ts'
import { isAutosave } from '../paths.ts'
import { defaultSocketPath } from './socketPath.ts'
import { MCP_TOOLS } from './toolDefinitions.ts'

import type { LaunchTarget, RecentSession } from '../ipc/channelTypes.ts'
import type { AppPaths } from '../paths.ts'
import type { BridgeToolResult } from './stdioServer.ts'
import type { BrowserWindow } from 'electron'

const RENDERER_TIMEOUT_MS = 150_000
const SCREENSHOT_WAIT_MS = 30_000
const OPEN_WAIT_MS = 90_000

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

  async function relayToRenderer(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<BridgeToolResult> {
    const win = getWindow()
    if (!win) {
      return {
        error:
          'JBrowse Desktop has no window open. Use the open tool or launch a session first.',
      }
    }
    const id = relayId++
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        relays.delete(id)
        resolve({ error: `The app did not answer "${tool}" in time` })
      }, RENDERER_TIMEOUT_MS)
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

  async function currentSessionId() {
    const response = await relayToRenderer('session_id', {})
    return response.error
      ? null
      : ((response.result as { id?: string | null } | undefined)?.id ?? null)
  }

  // openTarget resolves when the launch is HANDED OVER (a push, or a page
  // load), not when the new session is up — and a load that fails leaves the
  // old session open by design. Answering then would let the very next call
  // read the previous config's tracks as if they were the new one's, so this
  // waits for the session identity to actually change.
  async function openAndWait(
    target: Parameters<BridgeDeps['openTarget']>[0],
    opened: string,
  ): Promise<BridgeToolResult> {
    const before = await currentSessionId()
    await openTarget(target)
    const deadline = Date.now() + OPEN_WAIT_MS
    while (Date.now() < deadline) {
      const now = await currentSessionId()
      if (now !== null && now !== before) {
        const settled = await relayToRenderer('wait_ready', {
          timeoutMs: 30_000,
        })
        return { result: { opened, ...(settled.result as object | undefined) } }
      }
      await delay(1000)
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
    const settled = await relayToRenderer('wait_ready', { timeoutMs })
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

  const socketPath = defaultSocketPath()
  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    // a leftover from a crashed instance; the single-instance lock says no
    // other live one holds it
    fs.unlinkSync(socketPath)
  }

  const server = net.createServer(socket => {
    const rl = readline.createInterface({ input: socket })
    rl.on('line', line => {
      let request: { id: number; tool: string; args?: Record<string, unknown> }
      try {
        request = JSON.parse(line) as typeof request
      } catch {
        return
      }
      void dispatch(request.tool, request.args ?? {})
        .catch((e: unknown) => ({ error: String(e) }))
        .then(outcome => {
          if (!socket.destroyed) {
            socket.write(`${JSON.stringify({ id: request.id, ...outcome })}\n`)
          }
        })
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
