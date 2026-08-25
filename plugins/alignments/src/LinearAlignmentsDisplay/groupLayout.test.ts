import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  MIN_FIT_ROWS,
  buildLaidOutByGroup,
  ceilingCap,
  collectAcrossGroups,
  fitGroupMaxRows,
  groupMaxY,
  nextGroupHeightOverride,
  reclaimFitRows,
  someAcrossGroups,
} from './groupLayout.ts'

import type {
  ColoredByGroup,
  GroupLayoutContext,
  LaidOutByGroup,
} from './groupLayout.ts'

// Two reads at the same position, so any real layout pass stacks them on rows 0
// and 1. One region, one group.
function overlappingReadsContext(): GroupLayoutContext {
  return {
    order: [{ key: 'g', label: 'g' }],
    rawByGroup: new Map([
      [
        'g',
        new Map([
          [
            0,
            makePileupDataResult({
              readPositions: new Uint32Array([100, 200, 100, 200]),
            }),
          ],
        ]),
      ],
    ]),
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

// These two exercise the placement, not the cap policy, so any cap will do —
// `ceilingCap` because an ungrouped lane's is the one it would really get.
const cap = ceilingCap

function readYsOf(byGroup: LaidOutByGroup) {
  return [...(byGroup.get('g')?.get(0)?.readYs ?? [])]
}

test('buildLaidOutByGroup: places overlapping reads on their own rows', () => {
  const laid = buildLaidOutByGroup(overlappingReadsContext(), cap(100))
  expect(readYsOf(laid)).toEqual([0, 1])
  expect(groupMaxY(laid.get('g')!)).toBe(2)
})

// The label chip's chevron leaves a lane drawing its coverage band and no pileup,
// so `sections` reads its maxY as 0 however it was laid out. Placing the rows
// anyway spent a packing pass and `cloneWithLayout`'s per-base Y arrays on a band
// 0px tall — the same work `layoutGroupRowCounts` exists to skip.
test('buildLaidOutByGroup: a coverage-only lane is not laid out at all', () => {
  const laid = buildLaidOutByGroup(
    overlappingReadsContext(),
    cap(100),
    undefined,
    new Set(['g']),
  )
  expect(readYsOf(laid)).toEqual([0, 0])
  expect(groupMaxY(laid.get('g')!)).toBe(0)
})

test('fitGroupMaxRows: splits the post-overhead height evenly across groups', () => {
  // 1000px height, 2 groups, 100px of overhead between them => (1000 - 100)/2 =
  // 450px per group / 10px rows = 45 rows.
  expect(
    fitGroupMaxRows({
      height: 1000,
      visibleGroupCount: 2,
      rowHeight: 10,
      totalOverhead: 100,
      maxRows: 1000,
    }),
  ).toEqual({ rows: 45, source: 'budget' })
})

test('fitGroupMaxRows: never exceeds the display-wide cap', () => {
  expect(
    fitGroupMaxRows({
      height: 100000,
      visibleGroupCount: 2,
      rowHeight: 10,
      totalOverhead: 0,
      maxRows: 30,
    }),
    // and says so, which is what stops the label chip offering an expand that
    // would bank the very cap that clipped the lane
  ).toEqual({ rows: 30, source: 'ceiling' })
})

test('fitGroupMaxRows: floors to MIN_FIT_ROWS when the slice is tiny', () => {
  // Many groups / small viewport (8 groups, 45px each) => slice goes negative;
  // floor keeps a few rows (the stack then overflows and scrolls).
  expect(
    fitGroupMaxRows({
      height: 200,
      visibleGroupCount: 8,
      rowHeight: 10,
      totalOverhead: 360,
      maxRows: 1000,
    }),
  ).toEqual({ rows: MIN_FIT_ROWS, source: 'budget' })
})

test('fitGroupMaxRows: a collapsed group hands its pileup slice to the rest', () => {
  // 3 groups reserving 50px each (collapsed ones still show coverage), so
  // 1000 - 150 = 850px of pileup budget. With one group collapsed it divides
  // across the 2 still drawing => 425px / 10px = 42 rows (vs 283 -> 28 when all
  // three share it).
  expect(
    fitGroupMaxRows({
      height: 1000,
      visibleGroupCount: 3,
      rowHeight: 10,
      totalOverhead: 150,
      maxRows: 1000,
    }),
  ).toEqual({ rows: 28, source: 'budget' })
  expect(
    fitGroupMaxRows({
      height: 1000,
      visibleGroupCount: 2,
      rowHeight: 10,
      totalOverhead: 150,
      maxRows: 1000,
    }),
  ).toEqual({ rows: 42, source: 'budget' })
})

test('fitGroupMaxRows: all groups collapsed never divides by zero', () => {
  // No pileup is drawn, so the cap is irrelevant, but the math must stay finite.
  expect(
    fitGroupMaxRows({
      height: 1000,
      visibleGroupCount: 0,
      rowHeight: 10,
      totalOverhead: 150,
      maxRows: 60,
    }),
  ).toEqual({ rows: 60, source: 'ceiling' })
})

test('reclaimFitRows: sparse groups donate unused rows to truncated ones', () => {
  // cap 45. Group a fit in 5 rows (40 spare), b in 15 (30 spare), c truncated.
  // 70 spare -> one recipient c -> cap 45 + 70 = 115.
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 5, truncated: false },
        { key: 'b', usedRows: 15, truncated: false },
        { key: 'c', usedRows: 45, truncated: true },
      ],
      defaultMaxRows: 45,
      maxRows: 1000,
    }),
  ).toEqual(new Map([['c', { rows: 115, source: 'budget' }]]))
})

test('reclaimFitRows: spare splits evenly across multiple truncated groups', () => {
  // 60 spare from a, split across two truncated (b, c) => +30 each.
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 40, truncated: false },
        { key: 'b', usedRows: 100, truncated: true },
        { key: 'c', usedRows: 100, truncated: true },
      ],
      defaultMaxRows: 100,
      maxRows: 1000,
    }),
  ).toEqual(
    new Map([
      ['b', { rows: 130, source: 'budget' }],
      ['c', { rows: 130, source: 'budget' }],
    ]),
  )
})

test('reclaimFitRows: never raises a recipient past the global cap', () => {
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 0, truncated: false },
        { key: 'b', usedRows: 45, truncated: true },
      ],
      defaultMaxRows: 45,
      maxRows: 50,
    }),
    // Raised as far as the ceiling, and now labelled by it: a lane pinned there
    // has nothing left for an expand to give it.
  ).toEqual(new Map([['b', { rows: 50, source: 'ceiling' }]]))
})

test('reclaimFitRows: no second pass when nothing can move', () => {
  // No truncated recipient.
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 5, truncated: false },
        { key: 'b', usedRows: 10, truncated: false },
      ],
      defaultMaxRows: 45,
      maxRows: 1000,
    }),
  ).toBeUndefined()
  // No spare (every group truncated).
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 45, truncated: true },
        { key: 'b', usedRows: 45, truncated: true },
      ],
      defaultMaxRows: 45,
      maxRows: 1000,
    }),
  ).toBeUndefined()
})

// rowHeight 20, displayed 100px (5 rows) throughout unless noted.
const drag = (o: Partial<Parameters<typeof nextGroupHeightOverride>[0]>) =>
  nextGroupHeightOverride({
    dy: 0,
    rowHeight: 20,
    displayedPx: 100,
    existingPx: undefined,
    fullyShown: false,
    ...o,
  })

test('nextGroupHeightOverride: fresh grow-drag on a fully-shown group banks nothing', () => {
  expect(drag({ dy: 5, fullyShown: true })).toBeUndefined()
})

test('nextGroupHeightOverride: fresh shrink seeds from the displayed height', () => {
  expect(drag({ dy: -5, fullyShown: true })).toBe(95)
  expect(drag({ dy: -5, fullyShown: false })).toBe(95)
})

test('nextGroupHeightOverride: grows a truncated group past its content', () => {
  expect(drag({ dy: 5, fullyShown: false })).toBe(105)
  expect(drag({ dy: 5, existingPx: 110, fullyShown: false })).toBe(115)
})

test('nextGroupHeightOverride: growing a fully-shown group pins at its content', () => {
  expect(drag({ dy: 5, existingPx: 110, fullyShown: true })).toBe(100)
})

test('nextGroupHeightOverride: floors at one row', () => {
  expect(drag({ dy: -500 })).toBe(20)
})

test('nextGroupHeightOverride: clamps a stale over-content override to one row of headroom', () => {
  // existing 500px runs well past the 100px content; base clamps to 100+20 so a
  // reversing (shrink) drag only walks back one row of dead space, not 400px.
  expect(drag({ dy: -5, existingPx: 500, fullyShown: true })).toBe(115)
})

// The two-deep walk the legend's four presence scans share. Every one of them
// used to spell it out, and the failure mode is silent in the direction that
// matters: a scan stopping a level early collects nothing, so the legend simply
// lists fewer swatches than the picture has colors. Nothing else asserts the
// walk — `legendUtils.test.ts` starts from a present-set already built — so
// these are what say the nesting is right.

// Only the two fields these read, as the walk sees them.
function byGroup(
  groups: { readTagValues?: string[]; overlapPositions?: number[] }[][],
) {
  return new Map(
    groups.map((regions, g) => [
      `group${g}`,
      new Map(
        regions.map((r, i) => [
          i,
          {
            readTagValues: r.readTagValues,
            overlapPositions: new Uint32Array(r.overlapPositions ?? []),
          },
        ]),
      ),
    ]),
  ) as unknown as ColoredByGroup
}

test('collectAcrossGroups: unions every region of every group', () => {
  expect([
    ...collectAcrossGroups(
      byGroup([
        [{ readTagValues: ['a', 'b'] }, { readTagValues: ['b', 'c'] }],
        [{ readTagValues: ['d'] }],
      ]),
      d => d.readTagValues,
    ),
  ]).toEqual(['a', 'b', 'c', 'd'])
})

test('collectAcrossGroups: a field the worker did not ship contributes nothing', () => {
  // the guard is the helper's, so no call site needs its own `?? []`
  expect([
    ...collectAcrossGroups(
      byGroup([[{}, { readTagValues: ['a'] }]]),
      d => d.readTagValues,
    ),
  ]).toEqual(['a'])
})

test('collectAcrossGroups: no groups is the empty set, not a throw', () => {
  expect(collectAcrossGroups(byGroup([]), d => d.readTagValues).size).toBe(0)
})

test('someAcrossGroups: true from a region in any group', () => {
  const pred = (d: { overlapPositions: Uint32Array }) =>
    d.overlapPositions.length > 0
  expect(
    someAcrossGroups(byGroup([[{}], [{}, { overlapPositions: [1] }]]), pred),
  ).toBe(true)
  expect(someAcrossGroups(byGroup([[{}], [{}]]), pred)).toBe(false)
})

test('someAcrossGroups: stops at the first yes', () => {
  const seen: number[] = []
  someAcrossGroups(byGroup([[{ overlapPositions: [1] }, {}], [{}]]), d => {
    seen.push(d.overlapPositions.length)
    return d.overlapPositions.length > 0
  })
  expect(seen).toEqual([1])
})
