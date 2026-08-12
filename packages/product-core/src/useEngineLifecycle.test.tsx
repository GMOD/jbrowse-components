import { useState } from 'react'

import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

import { useCreateOnce, useDestroyOnUnmount } from './useEngineLifecycle.ts'

// The simulated remount is the entire subject here, so it has to actually
// happen — and `render(<StrictMode>…</StrictMode>)` does NOT produce it: React
// only runs it when StrictMode is the ROOT element, and this repo's `render`
// wraps everything it is given. `reactStrictMode` is RTL's own option and wraps
// above those, which is the whole reason the mock forwards options. See
// `packages/__mocks__/@testing-library/react.tsx`.
const strict = { reactStrictMode: true } as const

// the two members destroyViewState needs, on a real MST node so isAlive answers
let workersTerminated = 0
const FakeEngine = types.model('FakeEngine', {}).volatile(() => ({
  rpcManager: {
    destroy: () => {
      workersTerminated++
    },
  },
}))

beforeEach(() => {
  workersTerminated = 0
})

test('useCreateOnce builds once under StrictMode, where useState builds twice', () => {
  let onceCalls = 0
  let initializerCalls = 0
  function Probe() {
    useCreateOnce(() => ++onceCalls)
    // the spelling this hook exists to replace, measured right beside it
    useState(() => ++initializerCalls)
    return null
  }
  render(<Probe />, strict)

  expect(onceCalls).toBe(1)
  // If this ever drops to 1, React stopped double-invoking state initializers
  // and useCreateOnce is no longer buying anything — check that before deleting
  // it, rather than concluding the hook is pointless from the passing test above
  expect(initializerCalls).toBe(2)
})

test('the engine survives StrictMode mount -> cleanup -> mount', () => {
  let held: ReturnType<typeof FakeEngine.create> | undefined
  function Probe() {
    const engine = useCreateOnce(() => FakeEngine.create({}))
    useDestroyOnUnmount(engine)
    held = engine
    return null
  }
  render(<Probe />, strict)

  // the regression: a bare `useEffect(() => () => destroyViewState(engine), [])`
  // leaves the component holding a destroyed tree here, and the next commit
  // throws "[mobx-state-tree] Failed to find the parent of ...[dead]"
  expect(isAlive(held!)).toBe(true)
  expect(workersTerminated).toBe(0)
})

test('a real unmount tears the engine down', async () => {
  let held: ReturnType<typeof FakeEngine.create> | undefined
  function Probe() {
    const engine = useCreateOnce(() => FakeEngine.create({}))
    useDestroyOnUnmount(engine)
    held = engine
    return null
  }
  const { unmount } = render(<Probe />, strict)
  unmount()
  // the teardown is deferred by a microtask, so a real unmount has to be flushed
  await Promise.resolve()

  expect(isAlive(held!)).toBe(false)
  expect(workersTerminated).toBe(1)
})
