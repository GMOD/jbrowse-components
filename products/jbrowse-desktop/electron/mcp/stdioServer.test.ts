/**
 * @jest-environment node
 *
 * The MCP stdio server against a fake bridge socket speaking the same
 * newline-delimited line protocol the real one serves — so both sides of the
 * relay framing are pinned here without an Electron runtime.
 */
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { PassThrough } from 'node:stream'

import { runMcpStdioServer } from './stdioServer.ts'

interface JsonRpcResponse {
  id: number
  result?: Record<string, unknown> & {
    content?: { type: string; text?: string; data?: string }[]
    isError?: boolean
    tools?: { name: string }[]
    serverInfo?: { name: string }
  }
  error?: { code: number; message: string }
}

function startFakeBridge(
  reply: (request: { id: number; tool: string }) => Record<string, unknown>,
) {
  const socketPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'jb-mcp-test-')),
    'mcp.sock',
  )
  const connections = new Set<net.Socket>()
  const server = net.createServer(socket => {
    connections.add(socket)
    readline.createInterface({ input: socket }).on('line', line => {
      const request = JSON.parse(line) as { id: number; tool: string }
      socket.write(`${JSON.stringify({ id: request.id, ...reply(request) })}\n`)
    })
  })
  return new Promise<{ socketPath: string; close: () => void }>(resolve => {
    server.listen(socketPath, () => {
      resolve({
        socketPath,
        close: () => {
          for (const socket of connections) {
            socket.destroy()
          }
          server.close()
        },
      })
    })
  })
}

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup()
  }
})

function startServer(socketPath: string, onExit: () => void = () => {}) {
  const input = new PassThrough()
  const output = new PassThrough()
  const responses: JsonRpcResponse[] = []
  const waiters: ((r: JsonRpcResponse) => void)[] = []
  readline.createInterface({ input: output }).on('line', line => {
    const parsed = JSON.parse(line) as JsonRpcResponse
    const waiter = waiters.shift()
    if (waiter) {
      waiter(parsed)
    } else {
      responses.push(parsed)
    }
  })
  runMcpStdioServer({
    socketPath,
    version: '1.2.3',
    onExit,
    input,
    output,
  })
  cleanups.push(() => {
    input.end()
    output.end()
  })
  return {
    endInput: () => {
      input.end()
    },
    send: (message: Record<string, unknown>) => {
      input.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)
    },
    sendRaw: (line: string) => {
      input.write(`${line}\n`)
    },
    next: () =>
      new Promise<JsonRpcResponse>(resolve => {
        const buffered = responses.shift()
        if (buffered) {
          resolve(buffered)
        } else {
          waiters.push(resolve)
        }
      }),
  }
}

test('initialize, tools/list, and a relayed tools/call', async () => {
  const seen: string[] = []
  const bridge = await startFakeBridge(request => {
    seen.push(request.tool)
    return { result: { ok: true } }
  })
  const server = startServer(bridge.socketPath)

  server.send({ id: 1, method: 'initialize', params: {} })
  const init = await server.next()
  expect(init.result?.serverInfo).toEqual({
    name: 'jbrowse-desktop',
    version: '1.2.3',
  })

  server.send({ id: 2, method: 'tools/list' })
  const list = await server.next()
  const names = list.result?.tools?.map(t => t.name)
  expect(names).toEqual(['run_javascript', 'docs', 'open', 'screenshot'])

  server.send({
    id: 3,
    method: 'tools/call',
    params: { name: 'run_javascript', arguments: { code: 'return 1' } },
  })
  const call = await server.next()
  expect(seen).toEqual(['run_javascript'])
  expect(call.result?.isError).toBeUndefined()
  expect(JSON.parse(call.result?.content?.[0]?.text ?? '')).toEqual({
    ok: true,
  })
  bridge.close()
})

test('an image outcome becomes MCP image content', async () => {
  const bridge = await startFakeBridge(() => ({
    image: { data: 'aGk=', mimeType: 'image/png' },
  }))
  const server = startServer(bridge.socketPath)
  server.send({
    id: 1,
    method: 'tools/call',
    params: { name: 'screenshot', arguments: {} },
  })
  const call = await server.next()
  expect(call.result?.content?.[0]).toEqual({
    type: 'image',
    data: 'aGk=',
    mimeType: 'image/png',
  })
  bridge.close()
})

test('a bridge error outcome is an isError tool result, not a protocol error', async () => {
  const bridge = await startFakeBridge(() => ({ error: 'no session open' }))
  const server = startServer(bridge.socketPath)
  server.send({
    id: 1,
    method: 'tools/call',
    params: { name: 'run_javascript', arguments: { code: 'return 1' } },
  })
  const call = await server.next()
  expect(call.result?.isError).toBe(true)
  expect(call.result?.content?.[0]?.text).toBe('no session open')
  bridge.close()
})

test('the app not running reads as a launch hint, not a stack trace', async () => {
  const server = startServer(
    path.join(os.tmpdir(), 'jb-mcp-test-nonexistent', 'mcp.sock'),
  )
  server.send({
    id: 1,
    method: 'tools/call',
    params: { name: 'run_javascript', arguments: { code: 'return 1' } },
  })
  const call = await server.next()
  expect(call.result?.isError).toBe(true)
  expect(call.result?.content?.[0]?.text).toContain(
    'Launch the JBrowse Desktop app',
  )
})

test('an unknown tool is a JSON-RPC error', async () => {
  const bridge = await startFakeBridge(() => ({ result: {} }))
  const server = startServer(bridge.socketPath)
  server.send({
    id: 1,
    method: 'tools/call',
    params: { name: 'nope', arguments: {} },
  })
  const call = await server.next()
  expect(call.error?.code).toBe(-32602)
  bridge.close()
})

test('unparseable and non-object requests are answered, not dropped', async () => {
  const bridge = await startFakeBridge(() => ({ result: {} }))
  const server = startServer(bridge.socketPath)
  server.sendRaw('{not json')
  const parseError = await server.next()
  expect(parseError.error?.code).toBe(-32700)
  server.sendRaw('[{"jsonrpc":"2.0","id":1,"method":"ping"}]')
  const batch = await server.next()
  expect(batch.error?.code).toBe(-32600)
  bridge.close()
})

test('the initialize protocolVersion is what this server implements, not an echo', async () => {
  const server = startServer(
    path.join(os.tmpdir(), 'jb-mcp-test-nonexistent', 'mcp.sock'),
  )
  server.send({
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26' },
  })
  const init = await server.next()
  expect(init.result?.protocolVersion).toBe('2025-06-18')
})

test('an app restart mid-session reconnects instead of failing forever', async () => {
  const first = await startFakeBridge(() => ({ result: { generation: 1 } }))
  const server = startServer(first.socketPath)
  server.send({
    id: 1,
    method: 'tools/call',
    params: { name: 'run_javascript', arguments: { code: 'return 1' } },
  })
  expect((await server.next()).result?.isError).toBeUndefined()

  first.close()
  await new Promise(resolve => setTimeout(resolve, 50))
  // the app is down: the call fails but the server survives
  server.send({
    id: 2,
    method: 'tools/call',
    params: { name: 'run_javascript', arguments: { code: 'return 1' } },
  })
  expect((await server.next()).result?.isError).toBe(true)

  // a new instance on the same path: the next call succeeds
  const secondPath = first.socketPath
  const connections = new Set<net.Socket>()
  const revived = net.createServer(socket => {
    connections.add(socket)
    readline.createInterface({ input: socket }).on('line', line => {
      const request = JSON.parse(line) as { id: number }
      socket.write(
        `${JSON.stringify({ id: request.id, result: { generation: 2 } })}\n`,
      )
    })
  })
  await new Promise<void>(resolve => {
    fs.rmSync(secondPath, { force: true })
    revived.listen(secondPath, () => {
      resolve()
    })
  })
  cleanups.push(() => {
    for (const socket of connections) {
      socket.destroy()
    }
    revived.close()
  })
  server.send({
    id: 3,
    method: 'tools/call',
    params: { name: 'run_javascript', arguments: { code: 'return 1' } },
  })
  const call = await server.next()
  expect(call.result?.isError).toBeUndefined()
  expect(JSON.parse(call.result?.content?.[0]?.text ?? '')).toEqual({
    generation: 2,
  })
})

test('closing stdin drains in-flight calls before onExit', async () => {
  let answer: (() => void) | undefined
  const bridge = await startFakeBridgeAsync(request => {
    return new Promise(resolve => {
      answer = () => {
        resolve({ id: request.id, result: { ok: true } })
      }
    })
  })
  const state = { exited: false }
  const server = startServer(bridge.socketPath, () => {
    state.exited = true
  })
  server.send({
    id: 1,
    method: 'tools/call',
    params: { name: 'run_javascript', arguments: { code: 'return 1' } },
  })
  // wait for the request to reach the fake bridge, then close stdin with the
  // call still in flight — the response must still arrive, then onExit
  while (!answer) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  server.endInput()
  expect(state.exited).toBe(false)
  answer()
  const call = await server.next()
  expect(call.result?.isError).toBeUndefined()
  while (!state.exited) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  bridge.close()
})

function startFakeBridgeAsync(
  reply: (request: {
    id: number
    tool: string
  }) => Promise<Record<string, unknown>>,
) {
  const socketPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'jb-mcp-test-')),
    'mcp.sock',
  )
  const connections = new Set<net.Socket>()
  const server = net.createServer(socket => {
    connections.add(socket)
    readline.createInterface({ input: socket }).on('line', line => {
      const request = JSON.parse(line) as { id: number; tool: string }
      void reply(request).then(outcome => {
        socket.write(`${JSON.stringify(outcome)}\n`)
      })
    })
  })
  return new Promise<{ socketPath: string; close: () => void }>(resolve => {
    server.listen(socketPath, () => {
      resolve({
        socketPath,
        close: () => {
          for (const socket of connections) {
            socket.destroy()
          }
          server.close()
        },
      })
    })
  })
}
