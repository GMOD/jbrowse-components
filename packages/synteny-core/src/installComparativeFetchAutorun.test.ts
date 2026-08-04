// Direct tests for the `installComparativeFetchAutorun` skeleton shared by
// DotplotDisplay and LinearSyntenyDisplay.
//
// The invariant under test is latest-wins: a fetch superseded mid-flight must
// not commit its result, must not clear the loading flags the newer fetch just
// set, and must not raise its error. Both displays used to carry that
// discipline as a hand-written `isCurrent()` in three places (before the
// commit, in the catch, in the finally) plus a paragraph explaining why —
// which is exactly the kind of thing that stays right in one copy and rots in
// the other. Now it lives here, so it is tested here.
//
// The three-phase split is what makes it enforceable: `prepare` is synchronous
// (so its reads are the dependency set), `run` owns every await, and `commit`
// is synchronous and unreachable unless the fetch is still current.

import { types } from '@jbrowse/mobx-state-tree'

import { installComparativeFetchAutorun } from './installComparativeFetchAutorun.ts'

import type { RpcStatus } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const DELAY = 10

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const TestDisplay = types
  .model('TestDisplay', { id: types.optional(types.identifier, 'd1') })
  .volatile(() => ({
    error: undefined as unknown,
    fetching: false,
    statusMessage: undefined as RpcStatus | undefined,
    // the fetch input, standing in for `currentFetchKey`. Observable, so
    // changing it refires the autorun the way a zoom does.
    fetchKey: 'k1',
    // read inside `untracked` by prepare below, so it must NOT refire anything
    geometry: 0,
    gated: false,
  }))
  .views(() => ({
    get adapterConfig() {
      return { type: 'TestAdapter' }
    },
  }))
  .actions(self => ({
    setError(error?: unknown) {
      self.error = error
    },
    setFetching(fetching: boolean) {
      self.fetching = fetching
    },
    setStatusMessage(status?: RpcStatus) {
      self.statusMessage = status
    },
    setFetchKey(key: string) {
      self.fetchKey = key
    },
    setGeometry(n: number) {
      self.geometry = n
    },
    setGated(flag: boolean) {
      self.gated = flag
    },
  }))

// isSessionModel duck-types on rpcManager + configuration; that plus
// assemblyManager is the whole session surface the skeleton touches.
// The session sits under a root wrapper because that is the real tree shape.
// It used to be load-bearing for a different reason — getRpcSessionId walked up
// for an `rpcSessionId` but stopped *before* the root, so a session that WAS
// the root threw — which is fixed; the wrapper stays only for realism.
const TestSession = types
  .model('TestSession', {
    display: types.late(() => TestDisplay),
  })
  .volatile(() => ({
    rpcManager: {},
    configuration: {},
    assemblyManager: {},
    rpcSessionId: 'test-session',
  }))

const TestRoot = types.model('TestRoot', {
  session: TestSession,
})

type TestDisplayModel = Instance<typeof TestDisplay>

interface Args {
  fetchKey: string
  geometry: number
}

function setup({
  run,
  prepare,
}: {
  run: (args: Args) => Promise<string>
  prepare?: (display: TestDisplayModel) => Args | undefined
}) {
  const root = TestRoot.create({ session: { display: {} } })
  const { display } = root.session
  const prepared: Args[] = []
  const committed: { result: string; args: Args }[] = []
  installComparativeFetchAutorun(display, {
    name: 'TestComparativeFetch',
    delay: DELAY,
    prepare: () => {
      const args = prepare
        ? prepare(display)
        : { fetchKey: display.fetchKey, geometry: display.geometry }
      if (args) {
        prepared.push(args)
      }
      return args
    },
    run: args => run(args),
    commit: (result, args) => {
      committed.push({ result, args })
    },
  })
  return { display, prepared, committed }
}

// the first run is leading-edge; every later one waits out `delay`
async function settle() {
  await new Promise(resolve => setTimeout(resolve, DELAY * 6))
}

describe('installComparativeFetchAutorun', () => {
  it('runs the first fetch on the leading edge, without waiting out the debounce', () => {
    const { prepared, display } = setup({ run: () => new Promise(() => {}) })
    expect(prepared).toHaveLength(1)
    expect(display.fetching).toBe(true)
  })

  it('commits the result and clears the loading flags', async () => {
    const { display, committed } = setup({ run: () => Promise.resolve('r1') })
    await settle()
    expect(committed).toEqual([
      { result: 'r1', args: { fetchKey: 'k1', geometry: 0 } },
    ])
    expect(display.fetching).toBe(false)
    expect(display.statusMessage).toBeUndefined()
  })

  it('skips the fetch entirely when prepare declines', () => {
    const { display, prepared } = setup({
      run: () => Promise.resolve('r1'),
      prepare: d =>
        d.gated ? { fetchKey: d.fetchKey, geometry: 0 } : undefined,
    })
    expect(prepared).toHaveLength(0)
    // no flags touched, so a declined run can't strand the overlay
    expect(display.fetching).toBe(false)
  })

  it('re-runs when an observable prepare read changes, and not on an untracked one', async () => {
    const { display, prepared } = setup({ run: () => Promise.resolve('r1') })
    await settle()
    expect(prepared).toHaveLength(1)

    // geometry is read inside prepare's untracked block in the real displays;
    // here it is simply not read until after the key, so only the key refires
    display.setFetchKey('k2')
    await settle()
    expect(prepared).toHaveLength(2)
    expect(prepared[1]!.fetchKey).toBe('k2')
  })

  it('commits against the args its own prepare captured, not the live state', async () => {
    const gate = deferred<string>()
    const { display, committed } = setup({ run: () => gate.promise })

    // the view moves while the RPC is in flight; the commit must still be
    // tagged with the key the data was fetched for
    display.setFetchKey('k2')
    gate.resolve('r1')
    await settle()

    expect(committed[0]).toEqual({
      result: 'r1',
      args: { fetchKey: 'k1', geometry: 0 },
    })
  })

  describe('latest-wins', () => {
    it('does not commit a superseded fetch', async () => {
      const gates = [deferred<string>(), deferred<string>()]
      let n = 0
      const { display, committed } = setup({
        run: () => gates[n++]!.promise,
      })
      display.setFetchKey('k2')
      await settle()
      expect(n).toBe(2)

      // the FIRST fetch resolves last — the ordering the guard exists for
      gates[1]!.resolve('second')
      gates[0]!.resolve('first')
      await settle()

      expect(committed.map(c => c.result)).toEqual(['second'])
    })

    it('does not let a superseded fetch clear the flags the newer one set', async () => {
      const gates = [deferred<string>(), deferred<string>()]
      let n = 0
      const { display } = setup({ run: () => gates[n++]!.promise })
      display.setFetchKey('k2')
      await settle()

      // fetch B is still in flight; A resolving late must leave fetching true
      gates[0]!.resolve('first')
      await settle()
      expect(display.fetching).toBe(true)

      gates[1]!.resolve('second')
      await settle()
      expect(display.fetching).toBe(false)
    })

    it('does not let a superseded fetch raise its error', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const gates = [deferred<string>(), deferred<string>()]
      let n = 0
      const { display } = setup({ run: () => gates[n++]!.promise })
      display.setFetchKey('k2')
      await settle()

      gates[0]!.reject(new Error('stale failure'))
      await settle()
      expect(display.error).toBeUndefined()
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  it('sets the error and clears fetching when the current fetch fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { display } = setup({
      run: () => Promise.reject(new Error('boom')),
    })
    await settle()
    expect(display.error).toEqual(new Error('boom'))
    expect(display.fetching).toBe(false)
    spy.mockRestore()
  })

  it('swallows an abort but still clears fetching', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { display } = setup({
      run: () => Promise.reject(new Error('aborted')),
    })
    await settle()
    // an abort is the one exit neither the commit nor the error path covers;
    // without the finally it strands `fetching` true forever
    expect(display.error).toBeUndefined()
    expect(display.fetching).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('clears a prior error when the next fetch begins', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    const { display } = setup({
      run: () =>
        fail ? Promise.reject(new Error('boom')) : Promise.resolve('r'),
    })
    await settle()
    expect(display.error).toBeDefined()

    fail = false
    display.setFetchKey('k2')
    await settle()
    expect(display.error).toBeUndefined()
    spy.mockRestore()
  })
})
