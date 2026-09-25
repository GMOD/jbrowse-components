import { StrictMode, act } from 'react'

import { isAlive } from '@jbrowse/mobx-state-tree'
import { createRoot } from 'react-dom/client'

import createViewState from './createViewState.ts'
import { useCreateViewState } from './useCreateViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

// The mechanism, and why this can't go through @testing-library/react, are in
// packages/product-core/src/useEngineLifecycle.test.tsx. This pins the
// composition: that useCreateViewState is still built from
// useAsyncEngineLifecycle rather than the `useState` + cleanup-effect shape it
// used to be, which handed a StrictMode host a destroyed engine on first mount.
const builds = jest.fn(() => createViewState({ assembly }))

test.each([
  ['options', { assembly }],
  ['a build function', builds],
])(
  'a StrictMode host given %s is handed a live engine, and the engine dies with it',
  async (_, input) => {
    ;(
      globalThis as unknown as Record<string, unknown>
    ).IS_REACT_ACT_ENVIRONMENT = true
    builds.mockClear()
    let held: ViewModel | undefined
    function Probe() {
      const state = useCreateViewState(input)
      if (state) {
        held = state
      }
      return null
    }
    const div = document.createElement('div')
    document.body.append(div)
    const root = createRoot(div)
    // the engine resolves its lazily loaded state models first, so the first
    // render hands back undefined and the model arrives a commit later
    await act(async () => {
      root.render(
        <StrictMode>
          <Probe />
        </StrictMode>,
      )
    })
    expect(held && isAlive(held)).toBe(true)
    expect(builds).toHaveBeenCalledTimes(input === builds ? 1 : 0)

    // the teardown is deferred by a microtask, so a real unmount is awaited
    await act(async () => {
      root.unmount()
    })
    expect(held && isAlive(held)).toBe(false)
  },
)
