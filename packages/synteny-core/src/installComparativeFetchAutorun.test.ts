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
    // `SyntenyFetchStateMixin`'s retry counter, which the autorun reads
    // unconditionally
    reloadCounter: 0,
  }))
  .views(self => ({
    get adapterConfig() {
      return { type: 'TestAdapter' }
    },
    // `SyntenyFetchStateMixin`'s hook, read by the retry check the skeleton
    // installs. `gated` is a state this display deliberately does not fetch in,
    // which is exactly what the hook names — so a decline there is not the dead
    // Retry the check hunts for.
    get fetchInert() {
      return self.gated
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
    reload() {
      self.reloadCounter += 1
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

// Async because the leading edge is a microtask: every test starts from "the
// first run has happened", so a mutation made after it supersedes a fetch in
// flight rather than being coalesced into the first one.
async function setup({
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
  await Promise.resolve()
  return { display, prepared, committed }
}

// the first run is leading-edge; every later one waits out `delay`
async function settle() {
  await new Promise(resolve => setTimeout(resolve, DELAY * 6))
}

describe('installComparativeFetchAutorun', () => {
  it('runs the first fetch on the leading edge, without waiting out the debounce', async () => {
    // no timer advanced: `setup` awaits only the microtask the leading edge
    // yields for — see leadingEdgeAutorun
    const { prepared, display } = await setup({
      run: () => new Promise(() => {}),
    })
    expect(prepared).toHaveLength(1)
    expect(display.fetching).toBe(true)
  })

  it('commits the result and clears the loading flags', async () => {
    const { display, committed } = await setup({
      run: () => Promise.resolve('r1'),
    })
    await settle()
    expect(committed).toEqual([
      { result: 'r1', args: { fetchKey: 'k1', geometry: 0 } },
    ])
    expect(display.fetching).toBe(false)
    expect(display.statusMessage).toBeUndefined()
  })

  it('skips the fetch entirely when prepare declines', async () => {
    const { display, prepared } = await setup({
      run: () => Promise.resolve('r1'),
      prepare: d =>
        d.gated ? { fetchKey: d.fetchKey, geometry: 0 } : undefined,
    })
    expect(prepared).toHaveLength(0)
    // no flags touched, so a declined run can't strand the overlay
    expect(display.fetching).toBe(false)
  })

  it('re-runs when an observable prepare read changes, and not on an untracked one', async () => {
    const { display, prepared } = await setup({
      run: () => Promise.resolve('r1'),
    })
    await settle()
    expect(prepared).toHaveLength(1)

    // geometry is read inside prepare's untracked block in the real displays;
    // here it is simply not read until after the key, so only the key refires
    display.setFetchKey('k2')
    await settle()
    expect(prepared).toHaveLength(2)
    expect(prepared[1]!.fetchKey).toBe('k2')
  })

  // `FetchPhases.run` promises nothing it reads is tracked, and `run` being
  // async is not what buys that: it is CALLED synchronously, so its own prefix
  // down to its first `await` runs wherever the caller was — here, inside the
  // autorun's derivation, since the lifecycle is started unawaited. On the LGV
  // side an MST flow hides it; this family has no action to hide behind, so it
  // starts the lifecycle inside `untracked`. Without that, this refetches with
  // identical args on a read `prepare` deliberately never made.
  it('does not track what run reads before its first await', async () => {
    let display: TestDisplayModel | undefined
    const seen: number[] = []
    const { prepared } = await setup({
      // captured here because `run`'s closure needs the display and `setup`
      // fires the first run before it returns one
      prepare: d => {
        display = d
        return { fetchKey: d.fetchKey, geometry: 0 }
      },
      run: async () => {
        seen.push(display!.geometry)
        await Promise.resolve()
        return 'r1'
      },
    })
    await settle()
    expect(prepared).toHaveLength(1)
    expect(seen).toEqual([0])

    display!.setGeometry(1)
    await settle()

    expect(prepared).toHaveLength(1)
  })

  it('commits against the args its own prepare captured, not the live state', async () => {
    const gate = deferred<string>()
    const { display, committed } = await setup({ run: () => gate.promise })

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
      const { display, committed } = await setup({
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
      const { display } = await setup({ run: () => gates[n++]!.promise })
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
      const { display } = await setup({ run: () => gates[n++]!.promise })
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
    const { display } = await setup({
      run: () => Promise.reject(new Error('boom')),
    })
    await settle()
    expect(display.error).toEqual(new Error('boom'))
    expect(display.fetching).toBe(false)
    spy.mockRestore()
  })

  it('swallows an abort but still clears fetching', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { display } = await setup({
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
    const { display } = await setup({
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

// The retry contract for the comparative displays. After an error every fetch
// input is unchanged, so `prepare` recomputes the same key and nothing refires
// the autorun — which is why clearing the error alone would leave the banner's
// Retry a button that does nothing, and why the counter is read unconditionally
// rather than inside any display's `prepare`.
test('reload() refires the fetch with no input change', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  let attempt = 0
  const { display, prepared } = await setup({
    run: () => {
      attempt += 1
      return attempt === 1
        ? Promise.reject(new Error('PAF 404'))
        : Promise.resolve('ok')
    },
  })
  await settle()
  expect(`${display.error}`).toContain('PAF 404')
  expect(prepared).toHaveLength(1)

  display.reload()
  await settle()

  expect(prepared).toHaveLength(2)
  expect(display.error).toBeUndefined()
  spy.mockRestore()
})

test('reload() refires even while the gate is closed, so the wake chain holds', async () => {
  // `prepare` returning undefined still records its reads as dependencies; the
  // counter is read BEFORE that bail-out, so a reload during a gated state is
  // not swallowed.
  const { display, prepared } = await setup({
    run: () => Promise.resolve('ok'),
    prepare: d => (d.gated ? undefined : { fetchKey: d.fetchKey, geometry: 0 }),
  })
  await settle()
  expect(prepared).toHaveLength(1)

  display.setGated(true)
  await settle()
  expect(prepared).toHaveLength(1)

  display.reload()
  await settle()
  expect(prepared).toHaveLength(1) // still gated: reload does not bypass the gate

  display.setGated(false)
  await settle()
  expect(prepared).toHaveLength(2)
})

// The retry check the skeleton installs, which this family shipped a Retry
// button without. Its `reloadCounter` read guarantees the autorun re-RUNS, never
// that the run reaches a fetch — and after a failure every fetch input is
// unchanged, which is precisely when the button is dead.
test('a reload the gate does not clear is reported as a dead button', async () => {
  const { display, prepared } = await setup({
    run: () => Promise.resolve('ok'),
    // declines on something `reload()` does not touch, and does NOT say
    // `fetchInert` — the shape the check exists for
    prepare: d =>
      d.geometry > 0 ? undefined : { fetchKey: d.fetchKey, geometry: 0 },
  })
  await settle()
  expect(prepared).toHaveLength(1)
  expect(takeDisplayContractReports()).toEqual([])

  display.setGeometry(1)
  await settle()
  display.reload()
  await settle()

  expect(prepared).toHaveLength(1)
  expect(takeDisplayContractReports().join('\n')).toMatch(
    /Retry is a dead button/,
  )
})
