import { StrictMode, act, useState } from 'react'

import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { createRoot } from 'react-dom/client'

import { useCreateOnce, useDestroyOnUnmount } from './useEngineLifecycle.ts'

import type { Root } from 'react-dom/client'

// The remount is the entire subject here, so it has to actually happen — and
// through this repo's `render` it does NOT. A `<Suspense>` boundary ABOVE a
// `<StrictMode>` suppresses the simulated remount (measured: bare gives
// setup/cleanup/setup, Suspense-above gives setup, StrictMode-above-Suspense
// gives setup/cleanup/setup again), and `packages/__mocks__/@testing-library/
// react.tsx` wraps everything passed to `render` in exactly that boundary. So a
// StrictMode test written through RTL here passes while proving nothing, which
// is why this file drives the root API itself.
function mount(node: React.ReactNode) {
  const div = document.createElement('div')
  document.body.append(div)
  const root = createRoot(div)
  act(() => {
    root.render(<StrictMode>{node}</StrictMode>)
  })
  return root
}

// the teardown is deferred by a microtask, so a real unmount has to be flushed
async function unmount(root: Root) {
  await act(async () => {
    root.unmount()
  })
}

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
  // RTL normally sets this; driving the root ourselves, we have to. It only
  // silences the "not configured to support act(...)" warning — the simulated
  // remount happens either way, checked both ways before relying on it.
  ;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT =
    true
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
  mount(<Probe />)

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
  mount(<Probe />)

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
  const root = mount(<Probe />)
  await unmount(root)

  expect(isAlive(held!)).toBe(false)
  expect(workersTerminated).toBe(1)
})
