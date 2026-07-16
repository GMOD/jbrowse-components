import { waitFor } from '@testing-library/react'

import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

import type { BreakpointViewModel } from '@jbrowse/plugin-breakpoint-split-view'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(volvoxGetFile)

// The two halves of a paired record arrive as separate features, one per row,
// so these drive the real flow (adapter -> worker RPC -> overlayMatches) to
// assert the view rejoins them into a drawable connection, rather than only
// checking the helper in isolation.
function createBreakpointView(
  trackId: string,
  locs: [string, string],
): BreakpointViewModel {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('BreakpointSplitView', {
    init: locs.map(loc => ({ loc, assembly: 'volvox', tracks: [trackId] })),
  })
  view.setWidth(800)
  return view
}

async function waitForMatches(view: BreakpointViewModel, trackId: string) {
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )
  await waitFor(
    () => {
      expect(view.matchedTrackFeatures[trackId]).toBeDefined()
    },
    { timeout: 30000 },
  )
  return view.overlayMatches.get(trackId)!
}

test('pairs the two halves of an interchromosomal bedpe record', async () => {
  // volvox.bedpe row 2 spans A:21681-21682 <-> B:1982-1983
  const view = createBreakpointView('volvox_bedpe', [
    'ctgA:21,000..24,000',
    'ctgB:1,500..2,500',
  ])
  const match = await waitForMatches(view, 'volvox_bedpe')
  expect(match.kind).toBe('paired')

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

test('pairs the two halves of an interchromosomal STAR-Fusion record', async () => {
  // volvox.star-fusion.tsv EDEN--IPKMT2 spans A:2700 <-> B:1982. Fusion
  // features are paired the same way bedpe ones are, differing only in type
  const view = createBreakpointView('volvox_star_fusion', [
    'ctgA:2,000..3,500',
    'ctgB:1,500..2,500',
  ])
  const match = await waitForMatches(view, 'volvox_star_fusion')
  expect(match.kind).toBe('paired')

  const pair = match.layoutMatches.find(chunk =>
    chunk.some(m => m.feature.get('name') === 'EDEN--IPKMT2'),
  )
  expect(pair).toHaveLength(2)
  expect(pair!.map(m => m.level).sort()).toEqual([0, 1])
}, 40000)
