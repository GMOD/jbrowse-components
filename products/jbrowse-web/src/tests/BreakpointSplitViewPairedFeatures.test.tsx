import { waitFor } from '@testing-library/react'

import {
  utilizeFetchMockForTest,
  volvoxGetFile,
} from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

import type { BreakpointViewModel } from '@jbrowse/plugin-breakpoint-split-view'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(volvoxGetFile)

// volvox.bedpe pairs A(=ctgA) with B(=ctgB) — the interchromosomal case the
// breakpoint split view exists to show. The two halves of a record arrive as
// separate features, one per row, so this asserts the view actually rejoins
// them into a drawable connection rather than only checking the helper.
function createBedpeBreakpointView(): BreakpointViewModel {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('BreakpointSplitView', {
    init: [
      {
        loc: 'ctgA:21,000..24,000',
        assembly: 'volvox',
        tracks: ['volvox_bedpe'],
      },
      {
        loc: 'ctgB:1,500..2,500',
        assembly: 'volvox',
        tracks: ['volvox_bedpe'],
      },
    ],
  })
  view.setWidth(800)
  return view
}

test('pairs the two halves of an interchromosomal bedpe record', async () => {
  const view = createBedpeBreakpointView()

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )
  await waitFor(
    () => {
      expect(view.matchedTrackFeatures.volvox_bedpe).toBeDefined()
    },
    { timeout: 30000 },
  )

  const match = view.overlayMatches.get('volvox_bedpe')!
  expect(match.kind).toBe('paired')

  // A:21681-21682 <-> B:1982-1983 is the record spanning the two rows
  const pair = match.layoutMatches.find(chunk =>
    chunk.some(m => m.feature.get('start') === 21681),
  )
  expect(pair).toHaveLength(2)

  // the halves must land on different rows, and be the two ends of one record.
  // refNames stay as the adapter emitted them ('A'/'B'); canonicalization to
  // ctgA/ctgB happens where they're resolved against a view, not on the feature
  expect(pair!.map(m => m.level).sort()).toEqual([0, 1])
  expect(pair!.map(m => m.feature.get('refName')).sort()).toEqual(['A', 'B'])
}, 40000)
