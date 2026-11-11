import {
  getReExportRegistry,
  setReExportRegistry,
} from '@jbrowse/core/ReExports/registry'

import {
  captureConsole,
  codeErrorMessage,
  codePositions,
  handleMcpRequest,
} from './handleMcpRequest.ts'
import { drainPageErrors, watchPageErrors } from './pageErrors.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

function fakeApp() {
  const session = { views: [], snackbarMessages: [] as unknown[], name: 't' }
  const pluginManager = {
    rootModel: { session },
    jbrequire: () => undefined,
  } as unknown as PluginManager
  return { session, pluginManager }
}

// Every call settles on the clock afterwards (a 1s hold, up to a 5s deadline
// over this app, which never reports ready), and its code's own waits and
// timeoutMs are the clock's too, so the envelope runs on a fake one, drained
// to the answer.
async function run(pluginManager: PluginManager, code: string, extra = {}) {
  const answer = handleMcpRequest(
    { id: 1, tool: 'run_javascript', args: { code, ...extra } },
    pluginManager,
  ) as Promise<Record<string, unknown>>
  await Promise.allSettled([answer, jest.runAllTimersAsync()])
  return answer
}

describe('captureConsole', () => {
  it('records what the code prints and still forwards to the real console', () => {
    const logs: string[] = []
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const c = captureConsole(logs)
    c.log('a', { b: 1 })
    c.warn('careful')
    expect(logs).toEqual(['a {"b":1}', '[warn] careful'])
    expect(log).toHaveBeenCalledWith('a', { b: 1 })
    expect(warn).toHaveBeenCalledWith('careful')
    log.mockRestore()
    warn.mockRestore()
  })

  it('keeps the methods it does not shadow', () => {
    expect(typeof captureConsole([]).table).toBe('function')
  })

  it('stops recording after the cap and says so', () => {
    const logs: string[] = []
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const c = captureConsole(logs)
    for (let i = 0; i < 250; i++) {
      c.log(i)
    }
    expect(logs).toHaveLength(201)
    expect(logs.at(-1)).toMatch(/dropped/)
    spy.mockRestore()
  })
})

describe('codePositions', () => {
  it("rebases this call's lines onto the submitted code", () => {
    const stack =
      'Error: boom\n    at eval (run_javascript-7:6:9)\n    at real.ts:10:2'
    expect(codePositions(stack, 'run_javascript-7')).toEqual([
      { line: 3, column: 9 },
    ])
  })

  it('drops frames that fall inside the wrapper', () => {
    expect(
      codePositions('at run_javascript-7:2:1', 'run_javascript-7'),
    ).toEqual([])
  })

  it("skips another call's code, and a name this one only prefixes", () => {
    const stack =
      'Error: boom\n    at globalThis.parked (run_javascript-1:6:9)\n    at run_javascript-12:8:2\n    at eval (run_javascript-2:5:3)'
    expect(codePositions(stack, 'run_javascript-2')).toEqual([
      { line: 2, column: 3 },
    ])
  })
})

describe('codeErrorMessage', () => {
  it('appends the console output printed before the error', () => {
    expect(
      codeErrorMessage(new Error('x'), ['step 1'], 'run_javascript-1'),
    ).toBe('Error: x\nconsole output before the error:\nstep 1')
  })
})

describe('measure', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('reports the box of the first matching element', async () => {
    document.body.innerHTML = '<div data-testid="view-container-v1"></div>'
    const el = document.querySelector('[data-testid="view-container-v1"]')!
    el.getBoundingClientRect = () =>
      ({ x: 10.5, y: 20, width: 300, height: 200 }) as DOMRect
    const out = await handleMcpRequest(
      {
        id: 1,
        tool: 'measure',
        args: { selector: '[data-testid="view-container-v1"]' },
      },
      undefined,
    )
    expect(out).toEqual({
      x: 10.5,
      y: 20,
      width: 300,
      height: 200,
      scrollX: 0,
      scrollY: 0,
    })
  })

  it('says what a view is called when nothing matches', async () => {
    await expect(
      handleMcpRequest(
        { id: 1, tool: 'measure', args: { selector: '#nope' } },
        undefined,
      ),
    ).rejects.toThrow(/nothing on the page matches "#nope".*view-container/)
  })
})

describe('run_javascript envelope', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('carries logs beside the value', async () => {
    const { pluginManager } = fakeApp()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const out = await run(pluginManager, 'console.log("hi", 2); return 1')
    expect(out).toMatchObject({ value: 1, logs: ['hi 2'] })
    spy.mockRestore()
  })

  it('reports the line in the submitted code where it threw', async () => {
    const { pluginManager } = fakeApp()
    await expect(
      run(pluginManager, 'const a = 1\nconst b = 2\nthrow new Error("boom")'),
    ).rejects.toThrow(/Error: boom\n\s+at code line 3, column \d+/)
  })

  // every call's code used to share the name <anonymous>, so a function an
  // earlier call parked on globalThis that threw during this one was reported
  // as a line of this one's code
  it("names this call's line, not a line of an earlier call's code", async () => {
    const { pluginManager } = fakeApp()
    await run(
      pluginManager,
      '\n\n\nglobalThis.__mcpParked = () => { throw new Error("parked") }\nreturn 1',
    )
    await expect(
      run(pluginManager, 'const x = 1\nglobalThis.__mcpParked()'),
    ).rejects.toThrow(/Error: parked\n\s+at code line 2, column \d+/)
    delete (globalThis as Record<string, unknown>).__mcpParked
  })

  it('carries the page errors raised before the error, and only once', async () => {
    watchPageErrors()
    drainPageErrors()
    const { pluginManager } = fakeApp()
    window.dispatchEvent(
      Object.assign(new Event('error'), {
        error: new TypeError('x is not a function'),
      }),
    )
    await expect(run(pluginManager, 'throw new Error("boom")')).rejects.toThrow(
      /Error: boom[\s\S]*\npage errors raised before the error:\n- uncaught: TypeError: x is not a function/,
    )
    expect(await run(pluginManager, 'return 1')).not.toHaveProperty(
      'pageErrors',
    )
  })

  it('names a compile error for what it is', async () => {
    const { pluginManager } = fakeApp()
    await expect(run(pluginManager, 'return (')).rejects.toThrow(
      /SyntaxError: .*did not compile/,
    )
  })

  it('answers a call that outlives timeoutMs with its logs so far', async () => {
    const { pluginManager } = fakeApp()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    await expect(
      run(
        pluginManager,
        'console.log("started"); await new Promise(r => setTimeout(r, 5000)); return 1',
        { timeoutMs: 1000 },
      ),
    ).rejects.toThrow(
      /still running.*\nconsole output before the error:\nstarted/s,
    )
    spy.mockRestore()
  })

  it('hands the code an AbortSignal that fires at the deadline', async () => {
    const { pluginManager } = fakeApp()
    const direct = await run(
      pluginManager,
      'return signal instanceof AbortSignal',
    )
    expect(direct).toMatchObject({ value: true })
    const seen = { aborted: false }
    ;(globalThis as Record<string, unknown>).__mcpAbortProbe = () => {
      seen.aborted = true
    }
    await expect(
      run(
        pluginManager,
        'signal.addEventListener("abort", () => globalThis.__mcpAbortProbe()); await new Promise(r => setTimeout(r, 5000))',
        { timeoutMs: 1000 },
      ),
    ).rejects.toThrow(/still running/)
    expect(seen.aborted).toBe(true)
    delete (globalThis as Record<string, unknown>).__mcpAbortProbe
  })

  // core's map alone served @jbrowse/core and dropped the display toolkit a
  // runtime plugin's load would have served, so the same require worked or
  // threw depending on whether the config named a plugin
  it("fills an empty registry with desktop's own map, the one a plugin load installs", async () => {
    setReExportRegistry({})
    await run(fakeApp().pluginManager, 'return 1')
    expect(getReExportRegistry()).toHaveProperty([
      '@jbrowse/display-kit/configSchema',
    ])
  })

  it('delivers each notification once, with its level', async () => {
    const { pluginManager, session } = fakeApp()
    session.snackbarMessages.push({ message: 'track failed', level: 'error' })
    const first = await run(pluginManager, 'return 1')
    expect(first).toMatchObject({
      notifications: [{ level: 'error', message: 'track failed' }],
    })
    const second = await run(pluginManager, 'return 2')
    expect(second).not.toHaveProperty('notifications')
  })

  // a settle inside the code spends the toast, so the answer has to carry it
  // whichever way the call ends
  describe('a toast the code settled on', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div data-app-phase="ready"></div>'
    })

    it('rides the error when the code throws after the settle', async () => {
      const { pluginManager, session } = fakeApp()
      session.snackbarMessages.push({ message: 'track failed', level: 'error' })
      await expect(
        run(pluginManager, 'await jb.waitReady(5000); throw new Error("x")'),
      ).rejects.toThrow(
        /notifications raised before the error:\n- error: track failed/,
      )
    })

    it('reaches the next answer when a parked job settled after its call', async () => {
      const { pluginManager, session } = fakeApp()
      await run(
        pluginManager,
        'globalThis.__mcpParkedJob = jb.waitReady(5000); return 1',
      )
      session.snackbarMessages.push({ message: 'track failed', level: 'error' })
      await (globalThis as Record<string, unknown>).__mcpParkedJob
      delete (globalThis as Record<string, unknown>).__mcpParkedJob

      expect(await run(pluginManager, 'return 2')).toMatchObject({
        notifications: [{ level: 'error', message: 'track failed' }],
      })
    })
  })
})

// maxBytes bounds the value; the logs rode beside it bounded only by the entry
// count, so 200 large lines answered a 50 KB-capped call with 400 KB.
describe('the log budget', () => {
  it('stops at a total size well under the entry count', () => {
    const logs: string[] = []
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const c = captureConsole(logs)
    for (let i = 0; i < 100; i++) {
      c.log('x'.repeat(1000))
    }
    expect(logs.length).toBeLessThan(30)
    expect(logs.at(-1)).toMatch(/dropped after \d+ entries and \d+ chars/)
    expect(logs.join('').length).toBeLessThan(25_000)
    spy.mockRestore()
  })
})

// A client that gives up used to leave the code running for the rest of its
// budget, pinning the renderer with nobody left to read the answer.
describe('cancel', () => {
  function cancel(id: number, pluginManager: PluginManager) {
    return handleMcpRequest(
      { id: 99, tool: 'cancel', args: { id } },
      pluginManager,
    ) as Promise<{ cancelled: boolean }>
  }

  it('aborts the running call and answers it at once', async () => {
    const { pluginManager } = fakeApp()
    const call = handleMcpRequest(
      {
        id: 7,
        tool: 'run_javascript',
        args: {
          code: 'await new Promise(r => setTimeout(r, 30000)); return 1',
          timeoutMs: 30_000,
        },
      },
      pluginManager,
    )
    const outcome = call.then(
      () => 'resolved',
      (e: unknown) => (e as Error).message,
    )
    await Promise.resolve()
    expect(await cancel(7, pluginManager)).toEqual({ cancelled: true })
    expect(await outcome).toMatch(/CodeCancelledError: the client cancelled/)
  })

  it('names no line in the submitted code', async () => {
    const { pluginManager } = fakeApp()
    const call = handleMcpRequest(
      {
        id: 8,
        tool: 'run_javascript',
        args: { code: 'await new Promise(r => setTimeout(r, 30000))' },
      },
      pluginManager,
    ).catch((e: unknown) => (e as Error).message)
    await Promise.resolve()
    await cancel(8, pluginManager)
    expect(await call).not.toMatch(/at code line/)
  })

  // CodeCancelledError says cooperative work has stopped, and jb's own waits
  // polled on to their deadlines regardless
  describe("jb's own waits", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
      delete (globalThis as Record<string, unknown>).__mcpWait
    })

    function watch(promise: Promise<unknown>) {
      const seen = { outcome: 'pending' }
      promise.then(
        () => {
          seen.outcome = 'answered'
        },
        (e: unknown) => {
          seen.outcome = `${(e as Error).name}: ${(e as Error).message}`
        },
      )
      return seen
    }

    it('stop on a cancel, inside the code', async () => {
      const { pluginManager } = fakeApp()
      handleMcpRequest(
        {
          id: 11,
          tool: 'run_javascript',
          args: {
            code: 'globalThis.__mcpWait = jb.waitReady(30000); await globalThis.__mcpWait',
            timeoutMs: 60_000,
          },
        },
        pluginManager,
      ).catch(() => {})
      await jest.advanceTimersByTimeAsync(10)
      const wait = watch(
        (globalThis as Record<string, unknown>).__mcpWait as Promise<unknown>,
      )
      await cancel(11, pluginManager)
      await jest.advanceTimersByTimeAsync(500)
      expect(wait.outcome).toMatch(
        /^CallEndedError: this jb belongs to a run_javascript call that timed out or was cancelled/,
      )
    })

    it('stop on a cancel, in the settle after the code returned', async () => {
      const { pluginManager } = fakeApp()
      const call = watch(
        handleMcpRequest(
          { id: 12, tool: 'run_javascript', args: { code: 'return 1' } },
          pluginManager,
        ),
      )
      await jest.advanceTimersByTimeAsync(10)
      expect(call.outcome).toBe('pending')
      await cancel(12, pluginManager)
      await jest.advanceTimersByTimeAsync(500)
      expect(call.outcome).toMatch(
        /^Error: CodeCancelledError: the client cancelled/,
      )
    })
  })

  it('says so when nothing is running under that id', async () => {
    const { pluginManager } = fakeApp()
    expect(await cancel(404, pluginManager)).toEqual({ cancelled: false })
  })

  it('is answerable on the start screen, where no manager is installed', async () => {
    expect(await cancel(1, undefined as unknown as PluginManager)).toEqual({
      cancelled: false,
    })
  })
})

// A load `open` gave up waiting on is still running; reading that as the start
// screen told the agent to call open again, which restarted it.
describe('while a session is loading', () => {
  it('wait_ready says not settled, rather than start screen', async () => {
    const settle = (await handleMcpRequest(
      { id: 1, tool: 'wait_ready', args: {} },
      undefined,
      true,
    )) as { settled: boolean; note: string }
    expect(settle.settled).toBe(false)
    expect(settle.note).toMatch(/still loading/)
  })

  it('run_javascript says a load is in progress, not to call open', async () => {
    await expect(
      handleMcpRequest(
        { id: 1, tool: 'run_javascript', args: { code: 'return 1' } },
        undefined,
        true,
      ),
    ).rejects.toThrow(/still loading.*rather than calling open/)
  })

  it('the start screen still answers as the start screen', async () => {
    expect(
      await handleMcpRequest(
        { id: 1, tool: 'wait_ready', args: {} },
        undefined,
      ),
    ).toEqual({ settled: true, note: 'no session is open (start screen)' })
  })
})
