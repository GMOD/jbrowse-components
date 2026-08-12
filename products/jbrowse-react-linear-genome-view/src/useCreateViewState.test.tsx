import { StrictMode, act } from 'react'

import { isAlive } from '@jbrowse/mobx-state-tree'
import { createRoot } from 'react-dom/client'

import { useCreateViewState } from './useCreateViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

// The mechanism, and why this can't go through @testing-library/react, are in
// packages/product-core/src/useEngineLifecycle.test.tsx. This pins the
// composition: that useCreateViewState is still built from those two hooks
// rather than the `useState` + cleanup-effect shape it used to be, which handed
// a StrictMode host a destroyed engine on first mount. The circular and app
// products spell theirs identically.
test('a StrictMode host is handed a live engine, and the engine dies with it', async () => {
  ;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT =
    true
  let held: ViewModel | undefined
  function Probe() {
    held = useCreateViewState({ assembly })
    return null
  }
  const div = document.createElement('div')
  document.body.append(div)
  const root = createRoot(div)
  act(() => {
    root.render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    )
  })
  expect(isAlive(held!)).toBe(true)

  // the teardown is deferred by a microtask, so a real unmount is awaited
  await act(async () => {
    root.unmount()
  })
  expect(isAlive(held!)).toBe(false)
})
