import net from 'node:net'
import readline from 'node:readline'

import { MCP_TOOLS, SERVER_INSTRUCTIONS } from './toolDefinitions.ts'

// An MCP server over stdio (newline-delimited JSON-RPC 2.0), relaying every
// tools/call to the running app's bridge socket. Hand-rolled rather than the
// MCP SDK: the protocol subset a tools-only server needs (initialize, ping,
// tools/list, tools/call) is a page of code, and this file must run both as
// plain node and inside the electron binary (`--mcp`), so it takes no
// dependencies beyond node.

const PROTOCOL_VERSION = '2025-06-18'
const BRIDGE_TIMEOUT_MS = 180_000

interface JsonRpcRequest {
  jsonrpc?: string
  id?: number | string | null
  method?: string
  params?: Record<string, unknown>
}

// The tool result travelling back over the bridge (or produced locally).
// `result` is serialized as JSON text content; `text` is passed through
// verbatim (documentation); `image` becomes MCP image content.
export interface BridgeToolResult {
  result?: unknown
  error?: string
  text?: string
  image?: { data: string; mimeType: string }
}

function connectBridge(socketPath: string) {
  let socket: net.Socket | undefined
  let connecting: Promise<net.Socket> | undefined
  let nextId = 0
  const pending = new Map<
    number,
    { resolve: (r: BridgeToolResult) => void; reject: (e: Error) => void }
  >()

  function failAll(error: Error) {
    for (const { reject } of pending.values()) {
      reject(error)
    }
    pending.clear()
    socket = undefined
  }

  async function ensureSocket() {
    if (socket) {
      return socket
    }
    if (connecting) {
      return connecting
    }
    connecting = new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection(socketPath, () => {
        socket = s
        const rl = readline.createInterface({ input: s })
        rl.on('line', line => {
          // a killed app can leave a truncated final line (a screenshot is one
          // multi-MB line); it must fail that call, not the whole server
          let msg: (BridgeToolResult & { id: number }) | undefined
          try {
            msg = JSON.parse(line) as BridgeToolResult & { id: number }
          } catch {
            return
          }
          const entry = pending.get(msg.id)
          if (entry) {
            pending.delete(msg.id)
            entry.resolve(msg)
          }
        })
        resolve(s)
      })
      s.on('error', (e: Error) => {
        if (socket === s) {
          failAll(e)
        } else {
          reject(
            new Error(
              `Could not reach JBrowse Desktop at ${socketPath} (${e.message}). Launch the JBrowse Desktop app, then try again.`,
            ),
          )
        }
      })
      s.on('close', () => {
        if (socket === s) {
          failAll(new Error('JBrowse Desktop closed the connection'))
        }
      })
    })
    try {
      return await connecting
    } finally {
      connecting = undefined
    }
  }

  return async function call(tool: string, args: Record<string, unknown>) {
    const s = await ensureSocket()
    const id = nextId++
    return new Promise<BridgeToolResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`JBrowse Desktop did not answer "${tool}" in time`))
      }, BRIDGE_TIMEOUT_MS)
      pending.set(id, {
        resolve: r => {
          clearTimeout(timer)
          resolve(r)
        },
        reject: e => {
          clearTimeout(timer)
          reject(e)
        },
      })
      s.write(`${JSON.stringify({ id, tool, args })}\n`)
    })
  }
}

function toolCallContent(outcome: BridgeToolResult) {
  if (outcome.error !== undefined) {
    return {
      content: [{ type: 'text', text: outcome.error }],
      isError: true,
    }
  }
  if (outcome.image) {
    return {
      content: [
        {
          type: 'image',
          data: outcome.image.data,
          mimeType: outcome.image.mimeType,
        },
      ],
    }
  }
  if (outcome.text !== undefined) {
    return { content: [{ type: 'text', text: outcome.text }] }
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(outcome.result, null, 2) }],
  }
}

export function runMcpStdioServer({
  socketPath,
  version,
  onExit,
  input = process.stdin,
  output = process.stdout,
}: {
  socketPath: string
  version: string
  onExit: () => void
  input?: NodeJS.ReadableStream
  output?: NodeJS.WritableStream
}) {
  const callBridge = connectBridge(socketPath)
  const rl = readline.createInterface({ input })

  function respond(id: number | string | null, body: Record<string, unknown>) {
    output.write(`${JSON.stringify({ jsonrpc: '2.0', id, ...body })}\n`)
  }

  async function handle(msg: JsonRpcRequest) {
    const { id, method, params = {} } = msg
    if (method?.startsWith('notifications/')) {
      return
    }
    if (id === undefined || id === null) {
      return
    }
    switch (method) {
      case 'initialize': {
        // always PROTOCOL_VERSION: echoing an arbitrary requested revision
        // claims semantics (e.g. JSON-RPC batching) this server does not
        // implement; per spec the client then decides whether to proceed
        respond(id, {
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: 'jbrowse-desktop', version },
            instructions: SERVER_INSTRUCTIONS,
          },
        })
        break
      }
      case 'ping': {
        respond(id, { result: {} })
        break
      }
      case 'tools/list': {
        respond(id, {
          result: {
            tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({
              name,
              description,
              inputSchema,
            })),
          },
        })
        break
      }
      case 'tools/call': {
        const name = typeof params.name === 'string' ? params.name : ''
        const args =
          typeof params.arguments === 'object' && params.arguments !== null
            ? (params.arguments as Record<string, unknown>)
            : {}
        if (name === 'docs') {
          // answered here rather than in the app, so documentation reads work
          // while JBrowse Desktop is closed; lazy so jest never resolves the
          // .md imports it bundles
          const { docsToolResult } = await import('./docsContent.ts')
          respond(id, { result: toolCallContent(docsToolResult(args)) })
        } else if (MCP_TOOLS.some(t => t.name === name)) {
          const outcome = await callBridge(name, args).catch((e: unknown) => ({
            error: e instanceof Error ? e.message : String(e),
          }))
          respond(id, { result: toolCallContent(outcome) })
        } else {
          respond(id, {
            error: { code: -32602, message: `Unknown tool: ${name}` },
          })
        }
        break
      }
      default: {
        respond(id, {
          error: { code: -32601, message: `Method not found: ${method}` },
        })
      }
    }
  }

  const inFlight = new Set<Promise<void>>()
  rl.on('line', line => {
    if (line.trim()) {
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        respond(null, { error: { code: -32700, message: 'Parse error' } })
        return
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        respond(null, {
          error: { code: -32600, message: 'Invalid request (no batching)' },
        })
        return
      }
      const msg = parsed as JsonRpcRequest
      const work = handle(msg).catch((e: unknown) => {
        if (msg.id !== undefined && msg.id !== null) {
          respond(msg.id, {
            error: {
              code: -32603,
              message: e instanceof Error ? e.message : String(e),
            },
          })
        }
      })
      inFlight.add(work)
      void work.finally(() => inFlight.delete(work))
    }
  })
  rl.on('close', () => {
    // drain before exiting: a one-shot pipe closes stdin the moment it has
    // written its requests, while their answers are still being fetched — and
    // the final write (a screenshot is multi-MB) must reach the pipe before
    // the process dies
    void Promise.allSettled([...inFlight]).then(() => {
      const out = output as NodeJS.WritableStream & {
        writableNeedDrain?: boolean
      }
      if (out.writableNeedDrain) {
        out.once('drain', onExit)
      } else {
        onExit()
      }
    })
  })
}
