import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'

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
    expect(m.fetchSignal).toBe(0)
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
    // Cancel mid-flight, then reject. cancelFetch bumps fetchSignal so
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
  it('cancelFetch on idle still bumps fetchSignal (callers rely on this)', () => {
    const m = makeModel()
    const before = m.fetchSignal
    m.cancelFetch()
    expect(m.fetchSignal).toBe(before + 1)
  })

  it('cancelFetch mid-flight clears stop token, bumps signal, isLoading=false', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {})) // never resolves
    expect(m.isLoading).toBe(true)
    const before = m.fetchSignal
    m.cancelFetch()
    expect(m.isLoading).toBe(false)
    expect(m.fetchSignal).toBe(before + 1)
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

describe('FetchMixin: fetchSignal bump semantics', () => {
  it('bumps once on successful completion', async () => {
    const m = makeModel()
    const before = m.fetchSignal
    m.runFetch(async () => {})
    // Not yet bumped (start does not bump).
    expect(m.fetchSignal).toBe(before)
    await tick()
    await tick()
    expect(m.fetchSignal).toBe(before + 1)
  })

  it('bumps once on errored completion', async () => {
    const m = makeModel()
    const before = m.fetchSignal
    m.runFetch(() => Promise.reject(new Error('x')))
    expect(m.fetchSignal).toBe(before)
    await tick()
    await tick()
    expect(m.fetchSignal).toBe(before + 1)
  })

  it('bumps once on cancellation, not again when the cancelled flow finally runs', async () => {
    const m = makeModel()
    const before = m.fetchSignal
    let resolve!: () => void
    m.runFetch(() => new Promise<void>(r => (resolve = r)))
    m.cancelFetch()
    expect(m.fetchSignal).toBe(before + 1)
    resolve()
    await tick()
    await tick()
    // The flow's finally sees isStale()=true and skips its bump.
    expect(m.fetchSignal).toBe(before + 1)
  })
})

describe('FetchMixin: status message', () => {
  it('plugin can set status during fetch; cleared on completion', async () => {
    const m = makeModel()
    let setStatusFromWork: (() => void) | undefined
    let resolve!: () => void
    m.runFetch(async () => {
      m.setStatusMessage('working...')
      setStatusFromWork = () => m.setStatusMessage('almost done')
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
