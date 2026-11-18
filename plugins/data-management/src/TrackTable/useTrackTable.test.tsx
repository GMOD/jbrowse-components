import { getSession } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { render } from '@testing-library/react'

import { trackTableModelFactory } from './trackTableModel.ts'
import { useTrackTable } from './useTrackTable.ts'

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

test('the table model survives StrictMode mount -> cleanup -> mount', () => {
  const model = setup()
  const built: unknown[] = []
  let held: ReturnType<typeof useTrackTable> | undefined
  function Probe() {
    const table = useTrackTable(model, () => model.allTrackConfigurations)
    if (!built.includes(table)) {
      built.push(table)
    }
    held = table
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
  let held: ReturnType<typeof useTrackTable> | undefined
  function Probe() {
    held = useTrackTable(model, () => model.allTrackConfigurations)
    return null
  }
  const { unmount } = render(<Probe />, strict)
  unmount()
  // deferred by a microtask, so a real unmount has to be flushed
  await Promise.resolve()

  expect(isAlive(held!)).toBe(false)
})

test("a folder table and the drawer's keep each other's column choices", () => {
  const model = setup()
  let folder: ReturnType<typeof useTrackTable> | undefined
  function Probe() {
    folder = useTrackTable(model, () => model.allTrackConfigurations)
    return null
  }
  render(<Probe />, strict)
  folder!.setColumnVisible('description', true)
  model.trackTable.setColumnVisible('adapter', false)

  const reloaded = trackTableModelFactory().create()
  reloaded.setTrackSource(
    () => model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
  )
  for (const table of [folder!, model.trackTable, reloaded]) {
    expect(table.chosenColumns.shown).toEqual(['description'])
    expect([...table.chosenColumns.hidden]).toEqual(['adapter'])
  }
})
