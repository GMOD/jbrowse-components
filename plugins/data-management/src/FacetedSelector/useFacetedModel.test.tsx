import { isAlive } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { render } from '@testing-library/react'

import { useFacetedModel } from './useFacetedModel.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// jbrowse-web mounts in StrictMode, so this is the mode the dialog actually
// runs in. `reactStrictMode` rather than a `<StrictMode>` element because the
// repo's `render` wraps what it is given and React only simulates the remount
// for a root StrictMode — see packages/__mocks__/@testing-library/react.tsx.
const strict = { reactStrictMode: true } as const

beforeEach(() => {
  localStorage.clear()
})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  return view.activateTrackSelector() as HierarchicalTrackSelectorModel
}

test('the faceted model survives StrictMode mount -> cleanup -> mount', () => {
  const model = setup()
  const built: unknown[] = []
  let held: ReturnType<typeof useFacetedModel> | undefined
  function Probe() {
    const faceted = useFacetedModel(model, () => model.allTrackConfigurations)
    if (!built.includes(faceted)) {
      built.push(faceted)
    }
    held = faceted
    return null
  }
  render(<Probe />, strict)

  // the dialog goes on rendering whatever this hook returned, so a destroyed
  // tree here is every read in the grid throwing
  expect(isAlive(held!)).toBe(true)
  // and exactly one model was stood up, not one kept plus one orphaned with no
  // reference left to destroy it
  expect(built).toHaveLength(1)
})

test('a real unmount destroys the model', async () => {
  const model = setup()
  let held: ReturnType<typeof useFacetedModel> | undefined
  function Probe() {
    held = useFacetedModel(model, () => model.allTrackConfigurations)
    return null
  }
  const { unmount } = render(<Probe />, strict)
  unmount()
  // deferred by a microtask, so a real unmount has to be flushed
  await Promise.resolve()

  expect(isAlive(held!)).toBe(false)
})
