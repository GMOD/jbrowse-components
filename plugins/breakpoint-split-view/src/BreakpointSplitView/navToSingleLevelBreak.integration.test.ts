import { SimpleFeature } from '@jbrowse/core/util'
import {
  navToSingleLevelBreak,
  singleLevelFocusedSnapshotFromBreakendFeature,
} from '@jbrowse/sv-core'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const CTG_LEN = 100_000

// Two contigs of a round 100kb each, so every expected bpPerPx below is exact
// arithmetic rather than a tolerance.
const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: ['ctgA', 'ctgB'].map(refName => ({
        refName,
        uniqueId: `volvox-${refName}`,
        start: 0,
        end: CTG_LEN,
        seq: 'a'.repeat(CTG_LEN),
      })),
    },
  },
}

// A BND record: `pos` is its own end, `alt` names the mate's, VCF-1-based.
function breakend(refName: string, pos: number, alt: string) {
  return new SimpleFeature({
    uniqueId: 'bnd1',
    refName,
    start: pos,
    end: pos + 1,
    name: 'bnd1',
    ALT: [alt],
  })
}

// The nav helpers add the view themselves, so the width a sub-view needs before
// it can report `initialized` has to be set once it exists — which is what the
// React container does in the app.
async function launch(
  session: ReturnType<typeof createTestSession>,
  args: Parameters<typeof navToSingleLevelBreak>[0],
) {
  const p = navToSingleLevelBreak(args)
  await when(() => session.views.length > 0)
  const view = session.views[0] as unknown as BreakpointViewModel
  view.setWidth(800)
  await p
  return view.views[0]!
}

function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  return session
}

test('encompassing frames the padded span, in bp rather than pixels', async () => {
  const session = setup()
  const lgv = await launch(session, {
    session,
    assemblyName: 'volvox',
    // ctgA:60000 joined to ctgB:20000 (0-based)
    feature: breakend('ctgA', 60_000, 'A[ctgB:20001['),
    windowSize: 5000,
  })

  // whole contigs, in the order the record names them
  expect(lgv.displayedRegions.map(r => r.refName)).toEqual(['ctgA', 'ctgB'])

  // 55000..end of ctgA (45000bp) plus 0..25000 of ctgB = 70000bp over 800px.
  // Reading the second end's `offsetPx` as a bp offset instead double-counted
  // all of ctgA and gave 212.5.
  expect(lgv.bpPerPx).toBeCloseTo(70_000 / 800, 6)

  const left = lgv.pxToBp(0)
  expect(left.refName).toBe('ctgA')
  expect(left.coord).toBeCloseTo(55_000, -2)

  const right = lgv.pxToBp(lgv.width)
  expect(right.refName).toBe('ctgB')
  expect(right.coord).toBeCloseTo(25_000, -2)
})

test('encompassing handles a mate upstream of the record on one contig', async () => {
  const session = setup()
  const lgv = await launch(session, {
    session,
    assemblyName: 'volvox',
    // the other half of a reciprocal pair: ctgA:60000 joined back to ctgA:20000
    feature: breakend('ctgA', 60_000, '[ctgA:20001[A'),
    windowSize: 5000,
  })

  expect(lgv.displayedRegions.map(r => r.refName)).toEqual(['ctgA'])

  // 15000..65000. Handed to moveTo in record order the span is negative, which
  // it does not refuse — it zooms to minBpPerPx and scrolls somewhere else.
  expect(lgv.bpPerPx).toBeCloseTo(50_000 / 800, 6)
  expect(lgv.pxToBp(0).coord).toBeCloseTo(15_000, -2)
  expect(lgv.pxToBp(lgv.width).coord).toBeCloseTo(65_000, -2)
})

test('a mate upstream on one contig still gets two focused windows', async () => {
  const { snap } = await singleLevelFocusedSnapshotFromBreakendFeature({
    session: setup(),
    assemblyName: 'volvox',
    feature: breakend('ctgA', 60_000, '[ctgA:20001[A'),
    windowSize: 5000,
  })

  // Built in record order the two windows are [0,65001] and [15000,100000],
  // which overlap and merge into the whole contig — so the elided middle of the
  // rearrangement is exactly what the row shows.
  expect(snap.views[0]!.displayedRegions).toEqual([
    expect.objectContaining({ refName: 'ctgA', start: 0, end: 25_001 }),
    expect.objectContaining({ refName: 'ctgA', start: 55_000, end: CTG_LEN }),
  ])
})
