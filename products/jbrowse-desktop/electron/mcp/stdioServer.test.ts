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

function startServer(socketPath: string) {
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
    onExit: () => {},
    input,
    output,
  })
  cleanups.push(() => {
    input.end()
    output.end()
  })
  return {
    send: (message: Record<string, unknown>) => {
      input.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)
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
  expect(names).toContain('load_session_spec')
  expect(names).toContain('screenshot')

  server.send({
    id: 3,
    method: 'tools/call',
    params: { name: 'navigate', arguments: { loc: 'BRCA1' } },
  })
  const call = await server.next()
  expect(seen).toEqual(['navigate'])
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
    params: { name: 'get_session', arguments: {} },
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
    params: { name: 'get_session', arguments: {} },
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
