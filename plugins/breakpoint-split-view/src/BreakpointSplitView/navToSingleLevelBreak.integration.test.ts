import { SimpleFeature } from '@jbrowse/core/util'
import {
  navToMultiLevelBreak,
  navToSingleLevelBreak,
  singleLevelFocusedSnapshotFromBreakendFeature,
} from '@jbrowse/sv-core'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun } from 'mobx'

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
// it can report `initialized` has to be given to whatever view turns up — which
// is what the React container does in the app. An autorun rather than a
// one-shot: a relaunch can REPLACE the view mid-flight, and the replacement
// arrives unmeasured too.
async function withWidth<T>(
  session: ReturnType<typeof createTestSession>,
  body: () => Promise<T>,
) {
  const dispose = autorun(() => {
    for (const v of session.views) {
      if (v.type === 'BreakpointSplitView') {
        ;(v as unknown as BreakpointViewModel).setWidth(800)
      }
    }
  })
  try {
    return await body()
  } finally {
    dispose()
  }
}

function splitViews(session: ReturnType<typeof createTestSession>) {
  return session.views.filter(v => v.type === 'BreakpointSplitView')
}

// `moveTo` rounds its scroll to a whole pixel, so an edge lands within one
// pixel of the coordinate asked for and no closer. Assert that, rather than a
// bp tolerance that has to be re-guessed per zoom level.
function expectEdgeAt(
  edge: { coord: number },
  expected: number,
  bpPerPx: number,
) {
  expect(Math.abs(edge.coord - expected)).toBeLessThanOrEqual(bpPerPx)
}

async function launch(
  session: ReturnType<typeof createTestSession>,
  args: Parameters<typeof navToSingleLevelBreak>[0],
) {
  await withWidth(session, () => navToSingleLevelBreak(args))
  return (splitViews(session)[0] as unknown as BreakpointViewModel).views[0]!
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
  expectEdgeAt(left, 55_000, lgv.bpPerPx)

  const right = lgv.pxToBp(lgv.width)
  expect(right.refName).toBe('ctgB')
  expectEdgeAt(right, 25_000, lgv.bpPerPx)
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
  expectEdgeAt(lgv.pxToBp(0), 15_000, lgv.bpPerPx)
  expectEdgeAt(lgv.pxToBp(lgv.width), 65_000, lgv.bpPerPx)
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

const STABLE_ID = 'reused_volvox_breakpointsplitview'

// A launcher with no source view to copy tracks from: the SV inspector's chord
// clicks, the spreadsheet's row menu.
test('a relaunch with no tracks to apply re-navigates the same view', async () => {
  const session = setup()
  const args = {
    session,
    assemblyName: 'volvox',
    stableViewId: STABLE_ID,
    windowSize: 5000,
  }
  await launch(session, {
    ...args,
    feature: breakend('ctgA', 60_000, 'A[ctgB:20001['),
  })
  const first = splitViews(session)[0]!

  await launch(session, {
    ...args,
    feature: breakend('ctgA', 30_000, 'A[ctgB:70001['),
  })

  // the same node, not a rebuilt one, and it moved to the second record
  expect(splitViews(session)[0]).toBe(first)
  const lgv = (first as unknown as BreakpointViewModel).views[0]!
  expect(lgv.bpPerPx).toBeCloseTo(150_000 / 800, 6)
  expectEdgeAt(lgv.pxToBp(0), 25_000, lgv.bpPerPx)
})

// The dialog's "Copy tracks" is a decision about how the panels are BUILT, so
// applying it on a relaunch means rebuilding — in the slot the view already
// holds, rather than at the bottom of the session.
test('a relaunch that names a track set rebuilds the view in its slot', async () => {
  const session = setup()
  const args = {
    session,
    assemblyName: 'volvox',
    stableViewId: STABLE_ID,
    windowSize: 5000,
    feature: breakend('ctgA', 60_000, 'A[ctgB:20001['),
  }
  await launch(session, { ...args, tracks: [] })
  const first = splitViews(session)[0]!
  session.addView('LinearGenomeView', {})
  expect(session.views.indexOf(first)).toBe(0)

  await launch(session, { ...args, tracks: [] })

  const second = splitViews(session)[0]!
  expect(second).not.toBe(first)
  expect(second.id).toBe(STABLE_ID)
  // the slot, not appended below the view the reader was looking at
  expect(session.views.indexOf(second)).toBe(0)
  expect(session.views).toHaveLength(2)
})

test('a chain of a different length replaces the view in its slot', async () => {
  const session = setup()
  const args = {
    session,
    assemblyName: 'volvox',
    stableViewId: STABLE_ID,
    windowSize: 5000,
    feature: breakend('ctgA', 60_000, 'A[ctgB:20001['),
  }
  await withWidth(session, () => navToMultiLevelBreak(args))
  const first = splitViews(session)[0]!
  session.addView('LinearGenomeView', {})
  expect((first as unknown as BreakpointViewModel).views).toHaveLength(2)

  await withWidth(session, () =>
    navToMultiLevelBreak({
      ...args,
      stops: [
        { refName: 'ctgA', pos: 60_000 },
        { refName: 'ctgB', pos: 20_000 },
        { refName: 'ctgA', pos: 10_000 },
      ],
    }),
  )

  const second = splitViews(session)[0]!
  expect(second).not.toBe(first)
  expect((second as unknown as BreakpointViewModel).views).toHaveLength(3)
  expect(session.views.indexOf(second)).toBe(0)
  expect(session.views).toHaveLength(2)
})
