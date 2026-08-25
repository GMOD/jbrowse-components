import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { fittedReadPitch } from './groupLayout.ts'
import { NORMAL_PITCH } from './menus/compactnessPresets.ts'

import type { GroupLayoutContext } from './groupLayout.ts'

// `rows` reads stacked at one position, so the layout pass places each on its
// own row and the group's depth is exactly `rows`.
function stackedReads(rows: number) {
  const positions: number[] = []
  for (let i = 0; i < rows; i++) {
    positions.push(100, 200)
  }
  return new Map([
    [0, makePileupDataResult({ readPositions: new Uint32Array(positions) })],
  ])
}

function context(groups: { key: string; rows: number }[]): GroupLayoutContext {
  return {
    order: groups.map(g => ({ key: g.key, label: g.key })),
    rawByGroup: new Map(groups.map(g => [g.key, stackedReads(g.rows)])),
    isChainMode: false,
    sortedBy: undefined,
    showSoftClipping: false,
    largeFeaturesFirst: false,
    splicedReadsFirst: false,
    regions: new Map([[0, { refName: 'ctgA', start: 0, end: 1000 }]]),
    showLinkedReadLines: false,
    collapseGroupRows: false,
  }
}

function pitch(
  groups: { key: string; rows: number }[],
  opts: {
    fitTargetHeight: number
    // Summed over every group by the caller in production
    // (`totalBelowCoverageOverhead`), so a per-group figure is spelled here as
    // the product it used to be computed as.
    totalOverhead?: number
    collapsedKeys?: Set<string>
  },
) {
  return fittedReadPitch({
    ctx: context(groups),
    maxHeight: 10000,
    collapsedKeys: opts.collapsedKeys ?? new Set(),
    fitTargetHeight: opts.fitTargetHeight,
    totalOverhead: opts.totalOverhead ?? 0,
  })
}

test('divides the pileup space by the total row count, fractionally', () => {
  // 300px over 8 rows is 37.5 — but the Normal cap applies, see below. 8 rows
  // into 20px leaves 2.5px each, well under it.
  expect(pitch([{ key: 'a', rows: 8 }], { fitTargetHeight: 20 })).toBe(2.5)
})

// Every section reserves its own coverage + band stack, so the space left for
// reads is the target minus every section's.
test('one section of overhead is charged per group, not once for the display', () => {
  expect(
    pitch(
      [
        { key: 'a', rows: 5 },
        { key: 'b', rows: 5 },
      ],
      { fitTargetHeight: 90, totalOverhead: 30 },
    ),
  ).toBe(6)
  // Charging 15px once for the display instead would leave 75px and fit 7.5.
})

// The sum is the caller's, and it is a sum rather than a product because the
// strips below coverage are reserved per lane: the lane with no arc of its own
// reserves none, and the budget has to hand that height back to the rows.
test('an overhead only some lanes pay leaves the rest of them more room', () => {
  const groups = [
    { key: 'a', rows: 5 },
    { key: 'b', rows: 5 },
  ]
  // 15px of coverage each, plus a 20px arc strip on one lane only.
  expect(pitch(groups, { fitTargetHeight: 90, totalOverhead: 50 })).toBe(4)
  // Charging both lanes for the strip is 70px of overhead, leaving 20px — half
  // the room, for a strip only one of them draws.
})

// Choosing "fit" overrides the compactness preset, so the cap is the Normal
// pitch and never the configured size — otherwise Compact would override fit
// instead of the reverse. Without it a handful of reads in a tall display
// balloon to fill it.
test('never grows a read past the Normal pitch, however much room there is', () => {
  expect(pitch([{ key: 'a', rows: 1 }], { fitTargetHeight: 1000 })).toBe(
    NORMAL_PITCH,
  )
})

// Below 1px the reads can't all fit, so the stack scrolls rather than
// squeezing further.
test('floors at 1px rather than squeezing below a drawable read', () => {
  expect(pitch([{ key: 'a', rows: 500 }], { fitTargetHeight: 100 })).toBe(1)
})

// 0 is the "leave the configured height as-is" signal, and both ways of having
// nothing to fit reach it.
test('0 when there are no rows, and when the overhead eats the whole target', () => {
  expect(pitch([], { fitTargetHeight: 500 })).toBe(0)
  expect(
    pitch([{ key: 'a', rows: 4 }], {
      fitTargetHeight: 30,
      totalOverhead: 30,
    }),
  ).toBe(0)
})

// A collapsed lane draws no rows, so its depth must not be charged against the
// space the drawn lanes are being fitted into.
test('a collapsed lane contributes no rows', () => {
  const groups = [
    { key: 'a', rows: 5 },
    { key: 'b', rows: 45 },
  ]
  const target = { fitTargetHeight: 100 }
  expect(pitch(groups, target)).toBe(2)
  expect(pitch(groups, { ...target, collapsedKeys: new Set(['b']) })).toBe(
    NORMAL_PITCH,
  )
})
