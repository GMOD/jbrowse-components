import {
  captureConsole,
  codeErrorMessage,
  codePositions,
  handleMcpRequest,
} from './handleMcpRequest.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

function fakeApp() {
  const session = { views: [], snackbarMessages: [] as unknown[], name: 't' }
  const pluginManager = {
    rootModel: { session },
    jbrequire: () => undefined,
  } as unknown as PluginManager
  return { session, pluginManager }
}

function run(pluginManager: PluginManager, code: string, extra = {}) {
  return handleMcpRequest(
    { id: 1, tool: 'run_javascript', args: { code, ...extra } },
    pluginManager,
  ) as Promise<Record<string, unknown>>
}

describe('captureConsole', () => {
  it('records what the code prints and still forwards to the real console', () => {
    const logs: string[] = []
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const c = captureConsole(logs)
    c.log('a', { b: 1 })
    c.warn('careful')
    expect(logs).toEqual(['a {"b":1}', '[warn] careful'])
    expect(spy).toHaveBeenCalledWith('careful')
    spy.mockRestore()
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
  it('rebases V8 anonymous-function lines onto the submitted code', () => {
    const stack =
      'Error: boom\n    at eval (eval at evaluate (file.ts:1:1), <anonymous>:6:9)\n    at real.ts:10:2'
    expect(codePositions(stack)).toEqual([{ line: 3, column: 9 }])
  })

  it('drops frames that fall inside the wrapper', () => {
    expect(codePositions('<anonymous>:2:1')).toEqual([])
  })
})

describe('codeErrorMessage', () => {
  it('appends the console output printed before the error', () => {
    expect(codeErrorMessage(new Error('x'), ['step 1'])).toBe(
      'Error: x\nconsole output before the error:\nstep 1',
    )
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
})
