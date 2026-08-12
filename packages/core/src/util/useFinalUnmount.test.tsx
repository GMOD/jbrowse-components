import { Activity, useState } from 'react'

import { act, render } from '@testing-library/react'

import { useCreateOnce, useFinalUnmount } from './hooks.ts'

// `reactStrictMode`, not a `<StrictMode>` element: React only simulates the
// remount when StrictMode is the ROOT element, and this repo's `render` wraps
// what it is given. See packages/__mocks__/@testing-library/react.tsx.
const strict = { reactStrictMode: true } as const

function harness() {
  const log: string[] = []
  let builds = 0
  function Probe() {
    const value = useCreateOnce(() => ++builds)
    useFinalUnmount(() => {
      log.push(`cleanup(${value})`)
    })
    return null
  }
  return { log, Probe, builds: () => builds }
}

test('a StrictMode remount neither rebuilds nor tears down', () => {
  const { log, Probe, builds } = harness()
  render(<Probe />, strict)

  expect(builds()).toBe(1)
  expect(log).toEqual([])
})

// ONCE is the assertion, and it is the one that failed. Unmounting in the same
// synchronous block as the mount leaves StrictMode's own cancelled microtask
// still queued; it then finds the flag set again by the real cleanup and fires,
// and the real microtask fires too. Every teardown in the tree happened to be
// idempotent (destroyViewState guards on isAlive, MST destroy on a dead node),
// so nothing showed it.
test('a real unmount runs the cleanup exactly once', async () => {
  const { log, Probe } = harness()
  const { unmount } = render(<Probe />, strict)
  unmount()
  // deferred, so nothing has run yet
  expect(log).toEqual([])
  await Promise.resolve()
  expect(log).toEqual(['cleanup(1)'])
})

// the same thing with the microtasks drained in between, which is the ordinary
// case and was always fine — kept so a fix that only works for one of the two
// orderings fails here
test('a real unmount after the mount has settled also runs it once', async () => {
  const { log, Probe } = harness()
  const { unmount } = render(<Probe />, strict)
  await Promise.resolve()
  expect(log).toEqual([])
  unmount()
  await Promise.resolve()
  expect(log).toEqual(['cleanup(1)'])
})

// The documented limitation, pinned rather than asserted in prose. `<Activity>`
// destroys a hidden subtree's effects and re-creates them a TASK later, so the
// microtask cancel that absorbs StrictMode's synchronous cleanup/re-setup can't
// reach it: the teardown fires on hide, and showing again does not rebuild,
// because useCreateOnce's ref survives the hide.
//
// So a host that needs a view to survive being hidden has to own the engine
// itself with createViewState and keep it outside the hidden tree. If this test
// ever fails because nothing was torn down, React changed that and the caveat in
// useFinalUnmount's docblock should go.
test('a subtree hidden with Activity IS torn down, and is not rebuilt', async () => {
  const { log, Probe, builds } = harness()
  let setMode!: (m: 'visible' | 'hidden') => void
  function Host() {
    const [mode, setModeState] = useState<'visible' | 'hidden'>('visible')
    setMode = setModeState
    return (
      <Activity mode={mode}>
        <Probe />
      </Activity>
    )
  }
  render(<Host />, strict)
  expect(builds()).toBe(1)

  await act(async () => {
    setMode('hidden')
  })
  await act(async () => {
    await Promise.resolve()
  })
  expect(log).toEqual(['cleanup(1)'])

  await act(async () => {
    setMode('visible')
  })
  await act(async () => {
    await Promise.resolve()
  })
  // still the engine that was already torn down
  expect(builds()).toBe(1)
})
