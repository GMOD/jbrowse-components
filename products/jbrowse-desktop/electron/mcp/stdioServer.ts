import net from 'node:net'
import readline from 'node:readline'

import {
  GUIDANCE_PREFIX,
  MCP_TOOLS,
  SERVER_INSTRUCTIONS,
  SESSION_GAP_MS,
} from './toolDefinitions.ts'

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

// `result` crosses the socket as unknown; a settle's is always an object, and
// both tools that wait on one spread it into an answer of their own.
export function resultFields(result: unknown) {
  return (result ?? {}) as Record<string, unknown>
}

/**
 * Why the app could not be reached, told apart by which failure it was.
 *
 * These need different remedies and used to share one message: a file that is
 * not there means nothing has served this socket, while a file that refuses a
 * connection means something DID — a JBrowse Desktop that has since exited, or
 * one too old to serve the bridge at all. 4.3.0 has no `--mcp` handling, so
 * pointing a client at it launches the GUI and serves nothing; the app is then
 * on screen, in front of the user, while the only advice on offer was to launch
 * it.
 */
export function unreachableMessage(socketPath: string, e: Error) {
  const refused = (e as NodeJS.ErrnoException).code === 'ECONNREFUSED'
  return refused
    ? `A JBrowse Desktop was serving ${socketPath} and is not answering now (${e.message}). Either it has quit — relaunch it — or the one running is older than 5.0.0, which serves no MCP bridge: check Help, "Connect an AI agent...", which only exists in a build that does.`
    : `Could not reach JBrowse Desktop at ${socketPath} (${e.message}). Launch the JBrowse Desktop app, then try again.`
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
          reject(new Error(unreachableMessage(socketPath, e)))
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

  // `onSent` is handed the bridge's own id for this call, which is what a
  // cancel has to name: the JSON-RPC request id means nothing on the socket.
  return async function call(
    tool: string,
    args: Record<string, unknown>,
    onSent?: (bridgeId: number) => void,
  ) {
    const s = await ensureSocket()
    const id = nextId++
    onSent?.(id)
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

// The docs are bundled into this process at build time, so the packaged-app
// entry cannot drift from the app — but the standalone `node build/mcpServer.js`
// entry can drive a different install. The bridge answers app_version; a
// mismatch prefixes every docs answer rather than failing it, and an app old
// enough not to know app_version is itself proof of skew.
export function versionSkewNote(
  shimVersion: string,
  appAnswer: BridgeToolResult,
) {
  if (appAnswer.error !== undefined) {
    return appAnswer.error.startsWith('Unknown tool')
      ? `NOTE: the running JBrowse Desktop is older than this documentation (server ${shimVersion}); some of what it describes may not exist in the app.`
      : undefined
  }
  const appVersion = (appAnswer.result as { version?: unknown } | undefined)
    ?.version
  return typeof appVersion === 'string' && appVersion !== shimVersion
    ? `NOTE: this documentation is from version ${shimVersion} but the running JBrowse Desktop is ${appVersion} — where they disagree, introspect the app (jb.describeSlots, jb.inspect).`
    : undefined
}

function toolCallContent(outcome: BridgeToolResult) {
  if (outcome.error !== undefined) {
    return {
      content: [{ type: 'text', text: outcome.error }],
      isError: true,
    }
  }
  // additive, not three exclusive returns: screenshot carries BOTH the settle
  // result (its notifications are the only place an errored track is named)
  // and the image, and dropping either silently contradicts what the tool
  // description promises. Text first, so a client that truncates long content
  // keeps the part the agent has to act on.
  const text = outcome.text ?? JSON.stringify(outcome.result ?? {}, null, 2)
  const image = outcome.image
  return {
    content: [
      { type: 'text', text },
      ...(image
        ? [{ type: 'image', data: image.data, mimeType: image.mimeType }]
        : []),
    ],
  }
}

export function runMcpStdioServer({
  socketPath,
  version,
  onExit,
  input = process.stdin,
  output = process.stdout,
  now = Date.now,
}: {
  socketPath: string
  version: string
  onExit: () => void
  input?: NodeJS.ReadableStream
  output?: NodeJS.WritableStream
  now?: () => number
}) {
  const callBridge = connectBridge(socketPath)
  const rl = readline.createInterface({ input })

  // Whether the agent has been briefed this session: by reading the guide, or
  // by the guidance the first run_javascript result carried. Decided when the
  // call starts, so two calls in flight at once do not both carry it.
  let briefed = false
  let lastCallAt: number | undefined
  function startSessionIfIdle() {
    const t = now()
    if (lastCallAt !== undefined && t - lastCallAt > SESSION_GAP_MS) {
      briefed = false
    }
    lastCallAt = t
  }
  // After the tool's own answer, so content[0] stays the value every existing
  // caller parses (test/mcpConformance.ts, scripts/agent-demos); the model
  // reads the whole result either way.
  function brief<T extends { content: unknown[] }>(result: T): T {
    return {
      ...result,
      content: [
        ...result.content,
        { type: 'text', text: `${GUIDANCE_PREFIX}\n\n${SERVER_INSTRUCTIONS}` },
      ],
    }
  }

  // Checked once per observed answer, not per docs call: the app's version
  // cannot change while it runs, and an unreachable app leaves the question
  // open for the next call rather than caching "no skew".
  let skewNote: string | undefined
  let skewChecked = false
  async function docsSkewNote() {
    if (!skewChecked) {
      try {
        const answer = await Promise.race([
          callBridge('app_version', {}),
          new Promise<never>((_resolve, reject) => {
            setTimeout(() => {
              reject(new Error('app_version timed out'))
            }, 2000).unref()
          }),
        ])
        skewNote = versionSkewNote(version, answer)
        skewChecked = true
      } catch {
        // app closed or unreachable — the docs still answer, unannotated
      }
    }
    return skewNote
  }

  // A call the client has stopped waiting for, and the bridge call carrying it.
  // The spec says a cancelled request gets no response, so `respond` drops it —
  // and the app is told as well, because the code it is running is cooperative
  // and would otherwise pin the renderer for the rest of its budget with nobody
  // left to read the answer.
  const openRequests = new Set<number | string>()
  const cancelled = new Set<number | string>()
  const bridgeCallOf = new Map<number | string, number>()

  function respond(id: number | string | null, body: Record<string, unknown>) {
    if (id !== null) {
      openRequests.delete(id)
      bridgeCallOf.delete(id)
      if (cancelled.delete(id)) {
        return
      }
    }
    output.write(`${JSON.stringify({ jsonrpc: '2.0', id, ...body })}\n`)
  }

  function cancel(params: Record<string, unknown>) {
    const requestId = params.requestId
    if (
      (typeof requestId !== 'number' && typeof requestId !== 'string') ||
      !openRequests.has(requestId)
    ) {
      return
    }
    cancelled.add(requestId)
    const bridgeCall = bridgeCallOf.get(requestId)
    if (bridgeCall !== undefined) {
      void callBridge('cancel', { id: bridgeCall }).catch(() => {})
    }
  }

  async function handle(msg: JsonRpcRequest) {
    const { id, method, params = {} } = msg
    if (method?.startsWith('notifications/')) {
      if (method === 'notifications/cancelled') {
        cancel(params)
      }
      return
    }
    if (id === undefined || id === null) {
      return
    }
    openRequests.add(id)
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
            tools: MCP_TOOLS.map(
              ({ name, description, inputSchema, annotations }) => ({
                name,
                description,
                inputSchema,
                annotations,
              }),
            ),
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
        startSessionIfIdle()
        if (name === 'docs') {
          // answered here rather than in the app, so documentation reads work
          // while JBrowse Desktop is closed; lazy so jest never resolves the
          // .md imports it bundles
          const { docsToolResult } = await import('./docsContent.ts')
          const outcome = docsToolResult(args)
          if (args.topic === 'live-model') {
            briefed = true
          }
          const note = await docsSkewNote()
          respond(id, {
            result: toolCallContent(
              note && outcome.text !== undefined
                ? { ...outcome, text: `${note}\n\n${outcome.text}` }
                : outcome,
            ),
          })
        } else if (MCP_TOOLS.some(t => t.name === name)) {
          const needsBrief = name === 'run_javascript' && !briefed
          briefed ||= needsBrief
          const outcome = await callBridge(name, args, bridgeCall => {
            bridgeCallOf.set(id, bridgeCall)
          }).catch((e: unknown) => ({
            error: e instanceof Error ? e.message : String(e),
          }))
          const result = toolCallContent(outcome)
          respond(id, { result: needsBrief ? brief(result) : result })
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
