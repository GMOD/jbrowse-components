import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun } from 'mobx'

import { showRegionsWithUndo } from './showRegionsWithUndo.ts'

import type { LinearGenomeViewModel } from './index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const ctgA = { assemblyName: 'volMyt1', refName: 'ctgA' }

test('Undo publishes only the window it restores, not one clamped in between', () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 1_000_000 },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [{ ...ctgA, start: 0, end: 1_000_000 }],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.setWindow(8000, 600_000)
  const before = view.displayedRegions

  const notify = jest.spyOn(session, 'notify')
  showRegionsWithUndo({
    view,
    regions: [{ ...ctgA, start: 100, end: 200 }],
    message: 'moved',
  })
  const undo = [notify.mock.calls[0]![2]!]
    .flat()
    .find(a => a.name === 'Undo')!.onClick

  const published: { regions: unknown; startBp: number }[] = []
  const dispose = autorun(() => {
    published.push({
      regions: view.displayedRegions,
      startBp: view.windowStartBp,
    })
  })
  published.length = 0
  undo()
  dispose()

  expect(published).toEqual([{ regions: before, startBp: 600_000 }])
})
