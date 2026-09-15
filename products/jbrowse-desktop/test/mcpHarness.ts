// What launching the built app and speaking to its MCP bridge takes, shared by
// the conformance suite and the agent eval: the renderer served from build/,
// the electron main from build/electron.js, and a stdio client on the bridge
// socket that answers each call by id.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { defaultSocketPath } from '../electron/mcp/socketPath.ts'

import type { ChildProcess } from 'node:child_process'

export const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const repoRoot = path.resolve(desktopRoot, '../..')
export const volvoxConfig = path.join(repoRoot, 'test_data/volvox/config.json')

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

export function serveRendererBuild() {
  const buildDir = path.join(desktopRoot, 'build')
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
  return new Promise<{ port: number; close: () => void }>(resolve => {
    server.listen(0, () => {
      const address = server.address()
      resolve({
        port: typeof address === 'object' && address ? address.port : 0,
        close: () => {
          server.close()
        },
      })
    })
  })
}

export async function waitForBridge(timeoutMs: number) {
  const socketPath = defaultSocketPath()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const connected = await new Promise<boolean>(resolve => {
      const s = net.createConnection(socketPath, () => {
        s.destroy()
        resolve(true)
      })
      s.on('error', () => {
        resolve(false)
      })
    })
    if (connected) {
      return
    }
    if (Date.now() > deadline) {
      throw new Error(`bridge socket ${socketPath} never came up`)
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

// No config in argv: the app comes up on the start screen, so the first
// `open` runs the cold path — a page load rather than an in-place session
// swap, which is the route an agent's first call always takes.
export function launchApp(rendererPort: number): ChildProcess {
  const require = createRequire(import.meta.url)
  return spawn(
    require('electron') as unknown as string,
    ['.', '--no-sandbox'],
    {
      cwd: desktopRoot,
      stdio: 'ignore',
      env: {
        ...process.env,
        DEV_SERVER_URL: `http://localhost:${rendererPort}`,
      },
    },
  )
}

export interface ToolContent {
  type: string
  text?: string
  data?: string
}
export interface JsonRpcResponse {
  id: number
  result?: { content?: ToolContent[]; isError?: boolean }
  error?: { message: string }
}

export function startMcpClient() {
  const child = spawn('node', [path.join(desktopRoot, 'build/mcpServer.js')], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  // matched by id, not in order: a cancelled request is answered by nobody, and
  // a queue would then hand its slot to the next call's answer
  const waiters = new Map<number, (r: JsonRpcResponse) => void>()
  readline.createInterface({ input: child.stdout! }).on('line', line => {
    const response = JSON.parse(line) as JsonRpcResponse
    waiters.get(response.id)?.(response)
    waiters.delete(response.id)
  })
  let nextId = 0
  function send(method: string, params: Record<string, unknown>) {
    const id = ++nextId
    child.stdin!.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
    )
    return id
  }
  function notify(method: string, params: Record<string, unknown>) {
    child.stdin!.write(
      `${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`,
    )
  }
  async function rpc(method: string, params: Record<string, unknown>) {
    const id = send(method, params)
    return new Promise<JsonRpcResponse>(resolve => waiters.set(id, resolve))
  }
  async function callAll(name: string, args: Record<string, unknown> = {}) {
    const response = await rpc('tools/call', { name, arguments: args })
    const content = response.result?.content ?? []
    if (response.error ?? response.result?.isError) {
      throw new Error(
        `${name}: ${response.error?.message ?? content[0]?.text ?? 'tool error'}`,
      )
    }
    return content
  }
  async function call(name: string, args: Record<string, unknown> = {}) {
    return (await callAll(name, args))[0]
  }
  async function callJson(name: string, args: Record<string, unknown> = {}) {
    return JSON.parse((await call(name, args))?.text ?? 'null') as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >
  }
  return {
    rpc,
    send,
    notify,
    call,
    callAll,
    callJson,
    stop: () => {
      child.stdin!.end()
    },
  }
}

export type McpClient = ReturnType<typeof startMcpClient>

/**
 * The app up and a client on its bridge, with the volvox config opened from
 * the start screen. `attach` skips the launch and takes whatever Desktop is
 * already serving the socket.
 */
export async function openVolvox(attach: boolean) {
  const rendererServer = attach ? undefined : await serveRendererBuild()
  const app = rendererServer ? launchApp(rendererServer.port) : undefined
  await waitForBridge(attach ? 5000 : 90_000)
  const client = startMcpClient()
  await client.rpc('initialize', { protocolVersion: '2025-06-18' })
  // the bridge listens from app-ready, before the window exists, so the first
  // open may arrive before there is anything to navigate
  const openDeadline = Date.now() + 120_000
  let cold
  for (;;) {
    try {
      cold = await client.callJson('open', { target: volvoxConfig })
      break
    } catch (e) {
      if (Date.now() > openDeadline) {
        throw e
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  return {
    client,
    cold,
    stop: () => {
      client.stop()
      app?.kill()
      rendererServer?.close()
    },
  }
}
