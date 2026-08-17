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
    regions: new Map([[0, { refName: 'ctgA', start: 0, end: 1000 }]]),
    showLinkedReadLines: false,
    collapseGroupRows: false,
  }
}

function pitch(
  groups: { key: string; rows: number }[],
  opts: {
    fitTargetHeight: number
    coverageDisplayHeight?: number
    collapsedKeys?: Set<string>
  },
) {
  return fittedReadPitch({
    ctx: context(groups),
    maxHeight: 10000,
    collapsedKeys: opts.collapsedKeys ?? new Set(),
    fitTargetHeight: opts.fitTargetHeight,
    coverageDisplayHeight: opts.coverageDisplayHeight ?? 0,
  })
}

test('divides the pileup space by the total row count, fractionally', () => {
  // 300px over 8 rows is 37.5 — but the Normal cap applies, see below. 8 rows
  // into 20px leaves 2.5px each, well under it.
  expect(pitch([{ key: 'a', rows: 8 }], { fitTargetHeight: 20 })).toBe(2.5)
})

// Every section reserves its own coverage + band stack, so the space left for
// reads is the target minus one per section.
test('one section of overhead is charged per group, not once for the display', () => {
  expect(
    pitch(
      [
        { key: 'a', rows: 5 },
        { key: 'b', rows: 5 },
      ],
      { fitTargetHeight: 90, coverageDisplayHeight: 15 },
    ),
  ).toBe(6)
  // Charging it once for the display instead would leave 75px and fit 7.5.
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
      coverageDisplayHeight: 30,
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
