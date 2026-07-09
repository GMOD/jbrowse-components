/* eslint-disable @typescript-eslint/no-floating-promises */
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'

// FetchMixin logs console.error on non-abort failures; silence it here since
// error-path tests deliberately trigger these
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => jest.restoreAllMocks())

import type { FetchContext } from './FetchMixin.ts'

const TestModel = types.compose('Test', FetchMixin(), types.model({}))

function makeModel() {
  return TestModel.create({})
}

// Resolves on the next microtask tick. Used to let the runFetch flow
// finish its post-await work so we can assert on it.
function tick() {
  return Promise.resolve()
}

describe('FetchMixin: lifecycle state', () => {
  it('starts not loading, no error, no status', () => {
    const m = makeModel()
    expect(m.isLoading).toBe(false)
    expect(m.error).toBeUndefined()
    expect(m.statusMessage).toBeUndefined()
    expect(m.fetchGeneration).toBe(0)
    expect(m.activeStopToken).toBeUndefined()
  })

  it('isLoading flips true while runFetch is in flight, false after', async () => {
    const m = makeModel()
    let resolve!: () => void
    const work = (_ctx: FetchContext) =>
      new Promise<void>(r => {
        resolve = r
      })
    m.runFetch(work)
    expect(m.isLoading).toBe(true)
    resolve()
    await tick()
    await tick()
    expect(m.isLoading).toBe(false)
  })

  it('clears prior error at the start of a new fetch', async () => {
    const m = makeModel()
    m.setError(new Error('prior'))
    expect(m.error).toBeDefined()
    m.runFetch(async () => {})
    // Synchronously cleared at flow start (before any yield).
    expect(m.error).toBeUndefined()
    await tick()
    await tick()
  })
})

describe('FetchMixin: error handling', () => {
  it('records non-abort errors when not stale', async () => {
    const m = makeModel()
    const failure = new Error('boom')
    m.runFetch(() => Promise.reject(failure))
    await tick()
    await tick()
    expect(m.error).toBe(failure)
    expect(m.isLoading).toBe(false)
  })

  it('swallows abort exceptions (does not set error)', async () => {
    const m = makeModel()
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    m.runFetch(() => Promise.reject(abortErr))
    await tick()
    await tick()
    expect(m.error).toBeUndefined()
  })

  it('does not record error if fetch became stale before completing', async () => {
    const m = makeModel()
    let reject!: (e: unknown) => void
    m.runFetch(
      () =>
        new Promise<void>((_resolve, r) => {
          reject = r
        }),
    )
    // Cancel mid-flight, then reject. cancelFetch bumps fetchGeneration so
    // isStale() returns true in the flow's catch block — error stays
    // undefined.
    m.cancelFetch()
    reject(new Error('boom'))
    await tick()
    await tick()
    expect(m.error).toBeUndefined()
  })
})

describe('FetchMixin: cancellation', () => {
  it('cancelFetch on idle still bumps fetchGeneration (callers rely on this)', () => {
    const m = makeModel()
    const before = m.fetchGeneration
    m.cancelFetch()
    expect(m.fetchGeneration).toBe(before + 1)
  })

  it('cancelFetch mid-flight clears stop token, bumps signal, isLoading=false', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {})) // never resolves
    expect(m.isLoading).toBe(true)
    const before = m.fetchGeneration
    m.cancelFetch()
    expect(m.isLoading).toBe(false)
    expect(m.fetchGeneration).toBe(before + 1)
    expect(m.activeStopToken).toBeUndefined()
  })

  it('starting a new runFetch cancels the prior in-flight one', async () => {
    const m = makeModel()
    let firstRejected = false
    m.runFetch(ctx => {
      // Detect cancellation via stopToken aborted state. We can also
      // observe staleness — easier: simply yield an unresolved promise
      // and assert that the second fetch took over.
      return new Promise<void>((_resolve, reject) => {
        // Use a microtask check on isStale:
        void Promise.resolve().then(() => {
          if (ctx.isStale()) {
            firstRejected = true
            reject(new Error('cancelled'))
          }
        })
      })
    })
    const firstToken = m.activeStopToken
    m.runFetch(async () => {})
    expect(m.activeStopToken).not.toBe(firstToken)
    await tick()
    await tick()
    await tick()
    expect(firstRejected).toBe(true)
    expect(m.error).toBeUndefined() // first's rejection was swallowed
  })
})

describe('FetchMixin: user cancel + retry', () => {
  it('cancelFetchByUser stops the fetch and sets a durable fetchCanceled flag', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {})) // never resolves
    expect(m.isLoading).toBe(true)
    m.cancelFetchByUser()
    expect(m.isLoading).toBe(false)
    expect(m.fetchCanceled).toBe(true)
    expect(m.activeStopToken).toBeUndefined()
  })

  it('cancelFetchByUser does NOT bump fetchGeneration (so autoruns do not restart)', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    const before = m.fetchGeneration
    m.cancelFetchByUser()
    expect(m.fetchGeneration).toBe(before)
  })

  it('a new runFetch clears fetchCanceled (the retry path)', async () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    m.cancelFetchByUser()
    expect(m.fetchCanceled).toBe(true)
    m.runFetch(async () => {})
    expect(m.fetchCanceled).toBe(false)
    await tick()
    await tick()
  })

  it('internal cancelFetch clears fetchCanceled (it is a retrigger, not a stop)', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    m.cancelFetchByUser()
    expect(m.fetchCanceled).toBe(true)
    m.cancelFetch()
    expect(m.fetchCanceled).toBe(false)
  })
})

describe('FetchMixin: fetchGeneration bump semantics', () => {
  it('bumps once on successful completion', async () => {
    const m = makeModel()
    const before = m.fetchGeneration
    m.runFetch(async () => {})
    // Not yet bumped (start does not bump).
    expect(m.fetchGeneration).toBe(before)
    await tick()
    await tick()
    expect(m.fetchGeneration).toBe(before + 1)
  })

  it('bumps once on errored completion', async () => {
    const m = makeModel()
    const before = m.fetchGeneration
    m.runFetch(() => Promise.reject(new Error('x')))
    expect(m.fetchGeneration).toBe(before)
    await tick()
    await tick()
    expect(m.fetchGeneration).toBe(before + 1)
  })

  it('bumps once on cancellation, not again when the cancelled flow finally runs', async () => {
    const m = makeModel()
    const before = m.fetchGeneration
    let resolve!: () => void
    m.runFetch(() => new Promise<void>(r => (resolve = r)))
    m.cancelFetch()
    expect(m.fetchGeneration).toBe(before + 1)
    resolve()
    await tick()
    await tick()
    // The flow's finally sees isStale()=true and skips its bump.
    expect(m.fetchGeneration).toBe(before + 1)
  })
})

describe('FetchMixin: status message', () => {
  it('plugin can set status during fetch; cleared on completion', async () => {
    const m = makeModel()
    let setStatusFromWork: (() => void) | undefined
    let resolve!: () => void
    m.runFetch(async () => {
      m.setStatusMessage('working...')
      setStatusFromWork = () => {
        m.setStatusMessage('almost done')
      }
      await new Promise<void>(r => (resolve = r))
    })
    await tick()
    expect(m.statusMessage).toBe('working...')
    setStatusFromWork!()
    expect(m.statusMessage).toBe('almost done')
    resolve()
    await tick()
    await tick()
    expect(m.statusMessage).toBeUndefined()
  })

  it('cancelFetch clears status message when there was an active fetch', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    m.setStatusMessage('working...')
    m.cancelFetch()
    expect(m.statusMessage).toBeUndefined()
  })
})

describe('FetchMixin: progress reporting', () => {
  it('setStatusMessage splits a determinate status into message + fraction', () => {
    const m = makeModel()
    m.setStatusMessage({ message: 'Downloading', current: 1, total: 4 })
    expect(m.statusMessage).toBe('Downloading')
    expect(m.statusProgress).toBe(0.25)
  })

  it('setStatusMessage leaves progress undefined for an indeterminate status', () => {
    const m = makeModel()
    m.setStatusMessage('Processing')
    expect(m.statusMessage).toBe('Processing')
    expect(m.statusProgress).toBeUndefined()
  })

  it('setRegionStatus aggregates concurrent regions into one bar', () => {
    const m = makeModel()
    // two regions downloading in parallel: the bar reflects Σcurrent/Σtotal,
    // not whichever region reported last
    m.setRegionStatus(0, { message: 'Downloading', current: 30, total: 100 })
    m.setRegionStatus(1, { message: 'Downloading', current: 10, total: 100 })
    expect(m.statusMessage).toBe('Downloading')
    expect(m.statusProgress).toBeCloseTo(0.2)
  })

  it('setRegionStatus(key, undefined) drops a region from the aggregate', () => {
    const m = makeModel()
    m.setRegionStatus(0, { message: 'Downloading', current: 50, total: 100 })
    m.setRegionStatus(1, { message: 'Downloading', current: 0, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.25)
    m.setRegionStatus(1, undefined)
    expect(m.statusProgress).toBeCloseTo(0.5)
  })

  it('clears the aggregate when the last region finishes', () => {
    const m = makeModel()
    m.setRegionStatus(0, { message: 'Downloading', current: 1, total: 2 })
    m.setRegionStatus(0, undefined)
    expect(m.statusMessage).toBeUndefined()
    expect(m.statusProgress).toBeUndefined()
  })

  it('cancelFetch clears statusProgress and the per-region bookkeeping', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    m.setRegionStatus(0, { message: 'Downloading', current: 1, total: 2 })
    expect(m.statusProgress).toBeCloseTo(0.5)
    m.cancelFetch()
    expect(m.statusProgress).toBeUndefined()
    // a fresh fetch must not inherit the stale region entry
    m.setRegionStatus(1, { message: 'Downloading', current: 1, total: 4 })
    expect(m.statusProgress).toBeCloseTo(0.25)
  })
})

describe('FetchMixin: status callback throttle', () => {
  it('drops rapid callback updates within the 100ms window, applies the first', () => {
    const m = makeModel()
    const cb = m.makeStatusCallback()
    const now = jest.spyOn(Date, 'now')

    now.mockReturnValue(1000)
    cb({ message: 'Downloading', current: 1, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.01)

    // +50ms: inside the window, dropped, value unchanged
    now.mockReturnValue(1050)
    cb({ message: 'Downloading', current: 50, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.01)

    // +200ms from the last applied: past the window, applied
    now.mockReturnValue(1200)
    cb({ message: 'Downloading', current: 80, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.8)
  })

  it('passes updates spaced beyond the window through unthrottled', () => {
    const m = makeModel()
    const cb = m.makeStatusCallback()
    const now = jest.spyOn(Date, 'now')

    now.mockReturnValue(5000)
    cb('one')
    expect(m.statusMessage).toBe('one')

    now.mockReturnValue(5150)
    cb('two')
    expect(m.statusMessage).toBe('two')
  })

  it('resetStatus reopens the window so the next fetch reports immediately', () => {
    const m = makeModel()
    const cb = m.makeStatusCallback()
    const now = jest.spyOn(Date, 'now')

    now.mockReturnValue(2000)
    cb('first')
    expect(m.statusMessage).toBe('first')

    m.resetStatus()

    // only +50ms since the last write, but the reset cleared the throttle clock
    now.mockReturnValue(2050)
    cb('after reset')
    expect(m.statusMessage).toBe('after reset')
  })
})

describe('FetchMixin: isStale contract for work callbacks', () => {
  it('isStale is false during a normal fetch', async () => {
    const m = makeModel()
    let observedDuringWork = true
    m.runFetch(async ctx => {
      observedDuringWork = ctx.isStale()
    })
    await tick()
    await tick()
    expect(observedDuringWork).toBe(false)
  })

  it('isStale becomes true after cancelFetch is called mid-flight', async () => {
    const m = makeModel()
    let staleSnapshot: boolean | undefined
    let resolve!: () => void
    m.runFetch(async ctx => {
      await new Promise<void>(r => (resolve = r))
      staleSnapshot = ctx.isStale()
    })
    m.cancelFetch()
    resolve()
    await tick()
    await tick()
    expect(staleSnapshot).toBe(true)
  })

  it('isStale becomes true when a new runFetch supersedes the old', async () => {
    const m = makeModel()
    let staleSnapshot: boolean | undefined
    let resolve!: () => void
    m.runFetch(async ctx => {
      await new Promise<void>(r => (resolve = r))
      staleSnapshot = ctx.isStale()
    })
    m.runFetch(async () => {})
    resolve()
    await tick()
    await tick()
    await tick()
    expect(staleSnapshot).toBe(true)
  })
})
