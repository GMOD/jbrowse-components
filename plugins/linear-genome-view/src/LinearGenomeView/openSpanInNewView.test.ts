import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { openSpanInNewView } from './menuItems.ts'

import type { LinearGenomeViewModel } from './index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function setup() {
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
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1_000_000 },
    ],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.setWindow(8000, 400_000)
  return { session, view }
}

function openSpan(view: LinearGenomeViewModel) {
  const copy = openSpanInNewView(view, view.pxToBp(100), view.pxToBp(300)) as
    | LinearGenomeViewModel
    | undefined
  copy?.setWidth(800)
  return copy
}

test('the new view shows exactly the selection and the original stays put', () => {
  const { session, view } = setup()
  const copy = openSpan(view)!
  expect(session.views).toHaveLength(2)
  expect(copy.id).not.toBe(view.id)
  expect(copy.windowWidthBp).toBeCloseTo(2000, -1)
  expect(copy.windowStartBp).toBeCloseTo(401_000, -1)
  expect(view.windowWidthBp).toBe(8000)
  expect(view.windowStartBp).toBe(400_000)
})

test('the two views scroll and zoom independently', () => {
  const { view } = setup()
  const copy = openSpan(view)!
  const { windowStartBp, windowWidthBp } = copy
  view.horizontalScroll(500)
  view.zoomTo(view.bpPerPx * 2)
  expect(copy.windowStartBp).toBe(windowStartBp)
  expect(copy.windowWidthBp).toBe(windowWidthBp)
  copy.horizontalScroll(-300)
  expect(view.windowWidthBp).toBe(16_000)
})

test('the new view carries the tracks the view is showing', async () => {
  const { session, view } = setup()
  await when(
    () =>
      session.assemblyManager.assemblies.length ===
      session.assemblyManager.assemblyNamesList.length,
  )
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'Genes',
    type: 'FeatureTrack',
    assemblyNames: ['volMyt1'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  await view.launchTrack('genes')
  const copy = openSpan(view)!
  expect(copy.tracks.map(t => t.configuration.trackId)).toEqual(['genes'])
  expect(copy.tracks[0]!.id).not.toBe(view.tracks[0]!.id)
})

test('no selection opens nothing', () => {
  const { session, view } = setup()
  expect(openSpanInNewView(view, undefined, undefined)).toBeUndefined()
  expect(session.views).toHaveLength(1)
})
