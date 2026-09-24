/**
 * @jest-environment node
 *
 * The bridge's own state machine, against a fake renderer over a real socket.
 *
 * It runs in the MAIN process, where an uncaught throw takes the app down with
 * the user's unsaved session, and nothing reached it before but
 * test/mcpConformance.ts — which wants a built app, an Electron runtime and a
 * display. Everything electron is stubbed here: the bridge takes its window and
 * its launcher as arguments already, and only `ipcMain.handle` and
 * `webContents.send` had to be stood in for.
 */
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

import { ipcMain } from 'electron'

import { startMcpBridge } from './bridge.ts'

import type { McpBridgeRequest, McpReadyState } from '../ipc/channelTypes.ts'
import type { AppPaths } from '../paths.ts'
import type { BrowserWindow } from 'electron'

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  nativeImage: {},
}))

jest.mock('../paths.ts', () => ({ isAutosave: () => false }))

type IpcListener = (event: unknown, payload: never) => unknown

function client(socketPath: string, opened: net.Socket[]) {
  const answers = new Map<number, (r: Record<string, unknown>) => void>()
  const socket = net.createConnection(socketPath)
  opened.push(socket)
  readline.createInterface({ input: socket }).on('line', line => {
    const message = JSON.parse(line) as { id: number }
    answers.get(message.id)?.(message)
    answers.delete(message.id)
  })
  return {
    send: (id: number, tool: string, args: Record<string, unknown> = {}) => {
      const answered = new Promise<Record<string, unknown>>(resolve => {
        answers.set(id, resolve)
      })
      socket.write(`${JSON.stringify({ id, tool, args })}\n`)
      return answered
    },
    raw: (line: string) => {
      socket.write(`${line}\n`)
    },
    // a client process exiting, not a polite close
    destroy: () => {
      socket.destroy()
    },
  }
}

async function settle(ms = 30) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function start(openTarget: () => Promise<unknown> = () => Promise.resolve()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-bridge-test-'))
  const socketPath = path.join(dir, 'mcp.sock')
  const pushed: { channel: string; payload: McpBridgeRequest }[] = []
  const launched: unknown[] = []
  // server.close() leaves established connections open, and the jest worker
  // then cannot exit — "failed to exit gracefully" with every test green
  const clients: net.Socket[] = []
  // one window, not one per getWindow call: watchWindow subscribes to its
  // webContents, and a fresh object each time would leave those on a throwaway
  const contentsEvents = new Map<string, (...a: never[]) => void>()
  let crashed = false
  const webContents = {
    id: 1,
    send: (channel: string, payload: McpBridgeRequest) => {
      pushed.push({ channel, payload })
    },
    on: (event: string, listener: (...a: never[]) => void) => {
      contentsEvents.set(event, listener)
    },
    getBackgroundThrottling: () => false,
    setBackgroundThrottling: () => {},
    isCrashed: () => crashed,
    isDevToolsOpened: () => false,
    // what a minimized window's capture comes back as
    capturePage: async () => ({ isEmpty: () => true }),
  }
  const win = {
    webContents,
    getContentBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
  } as unknown as BrowserWindow

  const stop = startMcpBridge({
    paths: { recentSessionsPath: path.join(dir, 'recent.json') } as AppPaths,
    appVersion: '9.9.9',
    socketPath,
    getWindow: () => win,
    openTarget: target => {
      launched.push(target)
      return openTarget()
    },
  })
  const listeners = new Map<string, IpcListener>(
    jest
      .mocked(ipcMain.handle)
      .mock.calls.map(([channel, handler]) => [
        channel,
        handler as IpcListener,
      ]),
  )
  return {
    socketPath,
    pushed,
    launched,
    stop: () => {
      for (const socket of clients) {
        socket.destroy()
      }
      stop()
    },
    connect: () => client(socketPath, clients),
    ready: (state: McpReadyState) => {
      void listeners.get('mcpReady')?.(undefined, state as never)
    },
    answer: (id: number, outcome: Record<string, unknown>) => {
      void listeners.get('mcpResponse')?.(undefined, {
        id,
        ...outcome,
      } as never)
    },
    navigate: () => {
      contentsEvents.get('did-navigate')?.()
    },
    // a link click will-navigate cancels: it starts and never commits
    startNavigation: () => {
      contentsEvents.get('did-start-navigation')?.({
        isMainFrame: true,
        isSameDocument: false,
      } as never)
    },
    crash: () => {
      crashed = true
      contentsEvents.get('render-process-gone')?.(
        undefined as never,
        { reason: 'oom' } as never,
      )
    },
    // a crash no listener heard, because none was attached yet
    crashUnheard: () => {
      crashed = true
    },
    failLoad: (errorCode: number) => {
      contentsEvents.get('did-fail-load')?.(
        undefined as never,
        errorCode as never,
        '' as never,
        '' as never,
        true as never,
      )
    },
    // the last thing the bridge pushed at the renderer, which is what a relayed
    // tool call and a cancel both look like from here
    lastPush: () => pushed.at(-1)!.payload,
  }
}

let running: { stop: () => void } | undefined
afterEach(() => {
  running?.stop()
  running = undefined
  jest.mocked(ipcMain.handle).mockClear()
})

function bridge(openTarget?: () => Promise<unknown>) {
  const started = start(openTarget)
  running = started
  return started
}

describe('relaying a tool call', () => {
  it('pushes it to the renderer and answers with what came back', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    const answered = c.send(1, 'run_javascript', { code: 'return 1' })
    await settle()
    expect(b.lastPush().tool).toBe('run_javascript')
    b.answer(b.lastPush().id, { result: { value: 1 } })
    expect(await answered).toEqual({ id: 1, result: { value: 1 } })
  })

  // docs is answered inside the stdio server, so reaching the socket means a
  // client made the name up
  it('refuses a tool it does not serve rather than pushing it', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    expect(await c.send(1, 'docs')).toEqual({
      id: 1,
      error: 'Unknown tool: docs',
    })
    expect(b.pushed).toHaveLength(0)
  })

  it('answers app_version with no renderer involved', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    expect(await c.send(1, 'app_version')).toEqual({
      id: 1,
      result: { version: '9.9.9' },
    })
    expect(b.pushed).toHaveLength(0)
  })

  // nothing off the socket is trusted: this runs in the main process, where an
  // uncaught throw takes the app down with the user's unsaved session
  it('drops a malformed line and keeps serving', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    c.raw('{not json')
    c.raw('[1,2]')
    c.raw('null')
    c.raw('{"tool":"app_version"}')
    expect(await c.send(1, 'app_version')).toEqual({
      id: 1,
      result: { version: '9.9.9' },
    })
  })

  it('names the field when the tool is not a string', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    expect(await c.send(1, 7 as unknown as string)).toEqual({
      id: 1,
      error: 'Invalid request: "tool" must be a string',
    })
  })
})

// A page load tears the mcpRequest subscription down without telling anyone, so
// no mcpResponse is ever coming — and the relay used to sit out its whole
// timeout for a call that was already unanswerable.
it('settles the calls a page took with it when it navigated', async () => {
  const b = bridge()
  const c = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  const answered = c.send(1, 'run_javascript', { code: 'return 1' })
  await settle()
  b.navigate()
  expect(await answered).toEqual({
    id: 1,
    error: 'the page reloaded before the app answered; try again',
  })
})

it('keeps trusting a page whose navigation never commits', async () => {
  const b = bridge()
  const c = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  const inFlight = c.send(1, 'run_javascript', { code: 'return 1' })
  await settle()
  const relayId = b.lastPush().id
  b.startNavigation()
  void c.send(2, 'run_javascript', { code: 'return 2' })
  await settle()

  expect(b.lastPush()).toMatchObject({ tool: 'run_javascript' })
  expect(b.lastPush().id).not.toBe(relayId)
  b.answer(relayId, { result: { value: 1 } })
  expect(await inFlight).toEqual({ id: 1, result: { value: 1 } })
})

// A crashed renderer never announces again, so every call used to wait out its
// whole budget and a screenshot captured the dead page.
it('answers at once while the page is crashed, and relays again once reloaded', async () => {
  const b = bridge()
  const c = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  const inFlight = c.send(1, 'run_javascript', { code: 'return 1' })
  await settle()
  b.crash()
  const crashed = {
    error: "the app's page crashed (oom); use the open tool to reload it",
  }
  expect(await inFlight).toEqual({ id: 1, ...crashed })
  const pushes = b.pushed.length
  expect(await c.send(2, 'run_javascript', { code: 'return 2' })).toEqual({
    id: 2,
    ...crashed,
  })
  expect(b.pushed).toHaveLength(pushes)

  b.ready({ install: 'second', phase: 'session' })
  void c.send(3, 'run_javascript', { code: 'return 3' })
  await settle()
  expect(b.pushed).toHaveLength(pushes + 1)
})

it('sees a crash that happened before its first call', async () => {
  const b = bridge()
  const c = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  b.crashUnheard()

  expect(await c.send(1, 'run_javascript', { code: 'return 1' })).toEqual({
    id: 1,
    error: "the app's page crashed; use the open tool to reload it",
  })
  expect(b.pushed).toHaveLength(0)
})

// A load that fails commits an error page, which announces nothing and fires
// no did-navigate, so the bridge kept pushing into a page that answers nothing.
it('stops trusting a page a failed load replaced, but not a cancelled one', async () => {
  const b = bridge()
  const c = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  const inFlight = c.send(1, 'run_javascript', { code: 'return 1' })
  await settle()
  const relayId = b.lastPush().id

  b.failLoad(-3)
  b.answer(relayId, { result: { value: 1 } })
  expect(await inFlight).toEqual({ id: 1, result: { value: 1 } })

  const orphaned = c.send(2, 'run_javascript', { code: 'return 2' })
  await settle()
  b.failLoad(-105)
  expect(await orphaned).toEqual({
    id: 2,
    error: 'the page reloaded before the app answered; try again',
  })
})

it('a screenshot of a crashed page says so rather than capturing', async () => {
  const b = bridge()
  const c = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  void c.send(1, 'run_javascript', { code: 'return 1' })
  await settle()
  b.crash()

  expect(await c.send(2, 'screenshot')).toEqual({
    id: 2,
    error: "the app's page crashed (oom); use the open tool to reload it",
  })
})

it('a screenshot of a window that yields no image says why', async () => {
  const b = bridge()
  const c = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  const shot = c.send(1, 'screenshot')
  await settle()
  b.answer(b.lastPush().id, { result: { settled: true } })
  await settle()
  b.answer(b.lastPush().id, { result: { painted: true } })

  expect(await shot).toEqual({
    id: 1,
    error:
      'the window produced no image to capture, which a minimized JBrowse Desktop does; restore it and try again',
  })
})

it('cancels the code of a client that exits mid-call', async () => {
  const b = bridge()
  const gone = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  void gone.send(1, 'run_javascript', { code: 'x' })
  await settle()
  const relayId = b.lastPush().id
  gone.destroy()
  await settle()

  expect(b.lastPush()).toMatchObject({
    tool: 'cancel',
    args: { id: relayId },
  })
})

// The write into a half-closed pipe fails EPIPE and the socket emits 'error' —
// and readline forwards its input's errors to an Interface with no listener of
// its own, which threw out of the MAIN process and took the user's unsaved
// session with it. A regression does not fail this expectation; it takes the
// whole jest worker down, which is the honest shape of the bug.
it('survives a client that exits while its call is in flight', async () => {
  const b = bridge()
  const gone = b.connect()
  await settle()
  b.ready({ install: 'first', phase: 'session' })
  void gone.send(1, 'run_javascript', { code: 'x' })
  await settle()
  const relayId = b.lastPush().id
  gone.destroy()
  await settle()
  b.answer(relayId, { result: { value: 1 } })
  await settle()
  const next = b.connect()
  await settle()
  expect(await next.send(1, 'app_version')).toEqual({
    id: 1,
    result: { version: '9.9.9' },
  })
})

describe('open', () => {
  const url = 'https://example.org/config.json'

  it('waits for the new session, then for it to settle', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    const answered = c.send(1, 'open', { target: url })
    await settle()
    expect(b.launched).toEqual([{ type: 'link', url }])
    b.ready({ install: 'second', phase: 'session' })
    await settle(400)
    expect(b.lastPush().tool).toBe('wait_ready')
    b.answer(b.lastPush().id, { result: { settled: true } })
    expect(await answered).toEqual({
      id: 1,
      result: { opened: url, settled: true },
    })
  })

  // a big session running the renderer out of memory mid-load is the likeliest
  // crash, and open used to poll out its whole 90s deadline over it
  it('answers at once when the page crashes while it loads', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    const answered = c.send(1, 'open', { target: url })
    await settle()
    b.ready({ install: 'second', phase: 'loading' })
    b.crash()
    expect((await answered).error).toBe(
      `${url} did not load: the app's page crashed (oom); use the open tool to reload it`,
    )
  })

  it('says so when the load fell back to the start screen', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    const answered = c.send(1, 'open', { target: url })
    await settle()
    b.ready({ install: 'second', phase: 'startScreen' })
    expect((await answered).error).toMatch(/fell back to the start screen/)
  })

  // With a session open the launch is pushed and swapped in place, so a throw
  // leaves the old session standing: no plugin manager is installed, `install`
  // never changes, and this used to poll out its whole 90s deadline for a
  // session that was never coming.
  it('answers at once when the renderer could not load it', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    const answered = c.send(1, 'open', { target: url })
    await settle()
    b.ready({
      install: 'first',
      phase: 'session',
      launchError: { attempt: 1, message: 'Unexpected token < in JSON' },
    })
    const outcome = await answered
    expect(outcome.error).toMatch(/Unexpected token < in JSON/)
    expect(outcome.error).toMatch(/still open/)
  })

  // a failure the renderer reported before this call started is not this call's
  it('ignores a launch error that was already standing', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({
      install: 'first',
      phase: 'session',
      launchError: { attempt: 1, message: 'an earlier one' },
    })
    const answered = c.send(1, 'open', { target: url })
    await settle(400)
    b.ready({ install: 'second', phase: 'session' })
    await settle(400)
    b.answer(b.lastPush().id, { result: { settled: true } })
    expect(await answered).toEqual({
      id: 1,
      result: { opened: url, settled: true },
    })
  })

  it('refuses a relative path and names the hosted URL for a genome', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    const outcome = await c.send(1, 'open', { target: 'hg38' })
    expect(outcome.error).toMatch(/jbrowse.org\/ucsc\/hg38\/config.json/)
    expect(b.launched).toEqual([])
  })
})

describe('cancel', () => {
  async function inFlight(
    b: ReturnType<typeof bridge>,
    c: ReturnType<typeof client>,
    id: number,
  ) {
    const answered = c.send(id, 'run_javascript', { code: 'x' })
    await settle()
    return { answered, relayId: b.lastPush().id }
  }

  it('names the relay carrying the call the client gave up on', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    const { relayId } = await inFlight(b, c, 5)
    void c.send(6, 'cancel', { id: 5 })
    await settle()
    expect(b.lastPush()).toMatchObject({
      tool: 'cancel',
      args: { id: relayId },
    })
  })

  it('says so when nothing of that id is running', async () => {
    const b = bridge()
    const c = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    expect(await c.send(1, 'cancel', { id: 404 })).toEqual({
      id: 1,
      result: { cancelled: false },
    })
  })

  // Every client numbers its calls from zero, so two on the socket at once
  // (Claude Desktop beside Claude Code) both have a call 5.
  it("cannot reach another connection's call of the same id", async () => {
    const b = bridge()
    const first = b.connect()
    const second = b.connect()
    await settle()
    b.ready({ install: 'first', phase: 'session' })
    const mine = await inFlight(b, first, 5)
    const theirs = await inFlight(b, second, 5)
    expect(mine.relayId).not.toBe(theirs.relayId)
    void second.send(6, 'cancel', { id: 5 })
    await settle()
    expect(b.lastPush()).toMatchObject({
      tool: 'cancel',
      args: { id: theirs.relayId },
    })
  })
})
