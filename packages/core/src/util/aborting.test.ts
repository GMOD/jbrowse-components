import {
  checkAbortSignal,
  createAbortBreakpoint,
  isAbortException,
  withAbortCheck,
} from './aborting.ts'

describe('checkAbortSignal', () => {
  it('is a no-op for undefined and for a live signal', () => {
    expect(() => {
      checkAbortSignal(undefined)
    }).not.toThrow()
    expect(() => {
      checkAbortSignal(new AbortController().signal)
    }).not.toThrow()
  })

  it('throws an abort error once the signal aborts', () => {
    const controller = new AbortController()
    controller.abort()
    let thrown: unknown
    try {
      checkAbortSignal(controller.signal)
    } catch (e) {
      thrown = e
    }
    expect(isAbortException(thrown)).toBe(true)
  })
})

describe('isAbortException', () => {
  it('reads a timeout as a failure, not a cancel', async () => {
    const thrown = await new Promise<unknown>(resolve => {
      const signal = AbortSignal.timeout(1)
      signal.addEventListener('abort', () => {
        resolve(signal.reason)
      })
    })
    expect((thrown as Error).name).toBe('TimeoutError')
    expect(isAbortException(thrown)).toBe(false)
    const worded = new Error('The operation was aborted due to timeout')
    worded.name = 'TimeoutError'
    expect(isAbortException(worded)).toBe(false)
  })

  it('still reads an abort whose name was lost at a boundary', () => {
    expect(isAbortException(new Error('AbortError: aborted'))).toBe(true)
  })
})

describe('withAbortCheck', () => {
  it('refuses to start on an aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const fn = jest.fn(async () => 1)
    await expect(withAbortCheck(controller.signal, fn)).rejects.toThrow(
      /aborted/,
    )
    expect(fn).not.toHaveBeenCalled()
  })

  it('checks again after fn settles, so an abort during the await is seen', async () => {
    const controller = new AbortController()
    await expect(
      withAbortCheck(controller.signal, async () => {
        controller.abort()
        return 1
      }),
    ).rejects.toThrow(/aborted/)
  })

  it('returns the value when nothing aborts', async () => {
    await expect(
      withAbortCheck(new AbortController().signal, async () => 'v'),
    ).resolves.toBe('v')
  })
})

describe('createAbortBreakpoint', () => {
  it('lets an abort queued behind a busy loop land at the yield', async () => {
    const controller = new AbortController()
    const breakpoint = createAbortBreakpoint(controller.signal)
    setTimeout(() => {
      controller.abort()
    }, 5)
    const start = Date.now()
    await expect(
      (async () => {
        for (;;) {
          if (breakpoint.due()) {
            await breakpoint.yield()
          }
          if (Date.now() - start > 2000) {
            throw new Error('the loop never saw the abort')
          }
        }
      })(),
    ).rejects.toThrow(/aborted/)
  })

  it('works with no signal at all', async () => {
    const breakpoint = createAbortBreakpoint(undefined)
    expect(breakpoint.due()).toBe(true)
    await expect(breakpoint.yield()).resolves.toBeUndefined()
  })
})
