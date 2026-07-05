import {
  makeContentBlock,
  makeInterRegionPaddingBlock,
} from '@jbrowse/core/util/blockTypes'

import {
  getScalebarRefNameLabels,
  groupContiguousBlocks,
  makeBlockTicks,
  makeOverviewTicks,
  makeTicks,
  regionMoveActions,
  stickyBlockIndex,
} from './util.ts'

import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

// bpPerPx=5000 → chooseGridPitch gives majorPitch=1_000_000
const SCALE = 5000

describe('makeOverviewTicks', () => {
  test('forward from start=0 lands on neat multiples', () => {
    const ticks = makeOverviewTicks(0, 10_000_000, SCALE, false)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000,
      7_000_000, 8_000_000, 9_000_000, 10_000_000,
    ])
  })

  test('forward from non-zero start still lands on neat multiples', () => {
    const ticks = makeOverviewTicks(123_456, 10_000_000, SCALE, false)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000,
      7_000_000, 8_000_000, 9_000_000, 10_000_000,
    ])
  })

  test('forward offsetPx is relative to block start, not 0', () => {
    const ticks = makeOverviewTicks(123_456, 10_000_000, SCALE, false)
    // first tick at 1_000_000 is (1_000_000 - 123_456) / 5000 px from left edge
    expect(ticks[0]!.offsetPx).toBeCloseTo((1_000_000 - 123_456) / SCALE)
  })

  test('reversed from end=10M lands on neat multiples', () => {
    const ticks = makeOverviewTicks(0, 10_000_000, SCALE, true)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      9_000_000, 8_000_000, 7_000_000, 6_000_000, 5_000_000, 4_000_000,
      3_000_000, 2_000_000, 1_000_000,
    ])
  })

  test('reversed with non-zero start includes all neat multiples above start', () => {
    // start=500_000: tick at 1_000_000 should be included (> start)
    const ticks = makeOverviewTicks(500_000, 10_000_000, SCALE, true)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      9_000_000, 8_000_000, 7_000_000, 6_000_000, 5_000_000, 4_000_000,
      3_000_000, 2_000_000, 1_000_000,
    ])
  })

  test('returns empty array when no pitch multiple fits inside block', () => {
    // block narrower than one majorPitch with no multiple inside
    const ticks = makeOverviewTicks(1_100_000, 1_900_000, SCALE, false)
    expect(ticks).toEqual([])
  })
})

describe('tick calculation', () => {
  test('one', () => {
    const result = Array.from(makeTicks(0, 10, 0.05))
    expect(result).toEqual([
      { type: 'major', base: -1 },
      { type: 'minor', base: 0 },
      { type: 'minor', base: 1 },
      { type: 'minor', base: 2 },
      { type: 'minor', base: 3 },
      { type: 'minor', base: 4 },
      { type: 'minor', base: 5 },
      { type: 'minor', base: 6 },
      { type: 'minor', base: 7 },
      { type: 'minor', base: 8 },
      { type: 'major', base: 9 },
      { type: 'minor', base: 10 },
      { type: 'minor', base: 11 },
    ])
  })
  test('two', () => {
    const result = Array.from(makeTicks(0, 50, 1))
    expect(result).toEqual([
      { type: 'minor', base: -21 },
      { type: 'major', base: -1 },
      { type: 'minor', base: 19 },
      { type: 'minor', base: 39 },
      { type: 'minor', base: 59 },
      { type: 'minor', base: 79 },
    ])
  })
})

describe('makeBlockTicks', () => {
  test('forward x = (base - start) / bpPerPx', () => {
    const result = makeBlockTicks({ start: 0, end: 50 }, 1)
    expect(result.map(t => t.x)).toEqual([-21, -1, 19, 39, 59, 79])
  })
  test('reversed x = (end - base) / bpPerPx', () => {
    const result = makeBlockTicks({ start: 0, end: 50, reversed: true }, 1)
    expect(result.map(t => t.x)).toEqual([71, 51, 31, 11, -9, -29])
  })
  test('emitMinor=false keeps only major ticks', () => {
    const result = makeBlockTicks({ start: 0, end: 50 }, 1, true, false)
    expect(result.map(t => t.type)).toEqual(['major'])
  })
})

describe('groupContiguousBlocks', () => {
  const block = (
    displayedRegionIndex: number,
    start: number,
    end: number,
    offsetPx: number,
    reversed = false,
  ) =>
    makeContentBlock({
      key: `${start}`,
      assemblyName: 'volvox',
      refName: 'ctgA',
      start,
      end,
      reversed,
      offsetPx,
      widthPx: end - start,
      displayedRegionIndex,
    })

  test('merges a regions ~800px chunks into one run', () => {
    const runs = groupContiguousBlocks([
      block(0, 0, 800, 0),
      block(0, 800, 1600, 800),
    ])
    expect(runs).toEqual([
      { offsetPx: 0, widthPx: 1600, start: 0, end: 1600, reversed: false },
    ])
  })

  test('a new region starts a new run (no separator block between them)', () => {
    const runs = groupContiguousBlocks([
      block(0, 0, 800, 0),
      block(1, 0, 500, 800),
    ])
    expect(runs).toEqual([
      { offsetPx: 0, widthPx: 800, start: 0, end: 800, reversed: false },
      { offsetPx: 800, widthPx: 500, start: 0, end: 500, reversed: false },
    ])
  })

  test('an elided/padding block breaks a run', () => {
    const runs = groupContiguousBlocks([
      block(0, 0, 800, 0),
      makeInterRegionPaddingBlock({ key: 'pad', widthPx: 3, offsetPx: 800 }),
      block(0, 800, 1600, 803),
    ])
    expect(runs).toHaveLength(2)
  })
})

// scalebar refName labels

function refBlock({
  key,
  refName,
  displayedRegionIndex,
  offsetPx,
  widthPx,
  isLeftEndOfDisplayedRegion = false,
}: {
  key: string
  refName: string
  displayedRegionIndex: number
  offsetPx: number
  widthPx: number
  isLeftEndOfDisplayedRegion?: boolean
}) {
  return makeContentBlock({
    key,
    assemblyName: 'volvox',
    refName,
    start: 0,
    end: widthPx,
    offsetPx,
    widthPx,
    displayedRegionIndex,
    isLeftEndOfDisplayedRegion,
  })
}

// map of displayedRegionIndex -> right-edge px (offsetPx + widthPx)
function regionEnds(blocks: BaseBlock[]) {
  const m = new Map<number, number>()
  for (const b of blocks) {
    if (b.type === 'ContentBlock' && b.displayedRegionIndex !== undefined) {
      m.set(
        b.displayedRegionIndex,
        Math.max(m.get(b.displayedRegionIndex) ?? 0, b.offsetPx + b.widthPx),
      )
    }
  }
  return m
}

describe('stickyBlockIndex', () => {
  test('no content blocks yields -1', () => {
    expect(stickyBlockIndex([], 0)).toBe(-1)
  })

  test('nothing scrolled off left falls back to first content block', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'c1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
      }),
      refBlock({
        key: 'b',
        refName: 'c1',
        displayedRegionIndex: 0,
        offsetPx: 800,
        widthPx: 800,
      }),
    ]
    expect(stickyBlockIndex(blocks, 0)).toBe(0)
  })

  test('picks rightmost block whose left edge is off the left of the viewport', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'c1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
      }),
      refBlock({
        key: 'b',
        refName: 'c1',
        displayedRegionIndex: 0,
        offsetPx: 800,
        widthPx: 800,
      }),
      refBlock({
        key: 'c',
        refName: 'c1',
        displayedRegionIndex: 0,
        offsetPx: 1600,
        widthPx: 800,
      }),
    ]
    expect(stickyBlockIndex(blocks, 1000)).toBe(1)
  })
})

describe('getScalebarRefNameLabels', () => {
  test('one visible region: single sticky label pinned to the left', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
      refBlock({
        key: 'b',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 800,
        widthPx: 800,
      }),
    ]
    const { labels, showPrefixFallback } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      regionEndPx: regionEnds(blocks),
      prefix: '',
    })
    expect(showPrefixFallback).toBe(false)
    expect(labels).toEqual([
      {
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        transform: 0,
        maxWidth: 1598,
        paddingLeft: 0,
        text: 'chr1',
      },
    ])
  })

  test('prefix folds into the sticky label as prefix:refName', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
    ]
    const { labels, showPrefixFallback } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      regionEndPx: regionEnds(blocks),
      prefix: 'hg38',
    })
    expect(showPrefixFallback).toBe(false)
    expect(labels[0]!.text).toBe('hg38:chr1')
  })

  test('adjacent same-refName regions label the name once', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
      refBlock({
        key: 'b',
        refName: 'chr1',
        displayedRegionIndex: 1,
        offsetPx: 800,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
    ]
    const { labels } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      regionEndPx: regionEnds(blocks),
      prefix: '',
    })
    expect(labels.map(l => l.key)).toEqual(['a'])
  })

  test('scrolled past a region: run-start label offscreen-left + sticky pinned', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
      refBlock({
        key: 'b',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 800,
        widthPx: 800,
      }),
    ]
    const { labels } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 1000,
      regionEndPx: regionEnds(blocks),
      prefix: '',
    })
    // run-start block 'a' is pushed off the left (negative transform); block 'b'
    // is the sticky one pinned to the viewport edge (transform 0)
    expect(labels.map(l => ({ key: l.key, transform: l.transform }))).toEqual([
      { key: 'a', transform: -1001 },
      { key: 'b', transform: 0 },
    ])
  })

  test('too-narrow sticky region drops its label, prefix falls back to standalone', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 10,
        isLeftEndOfDisplayedRegion: true,
      }),
    ]
    const { labels, showPrefixFallback } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      regionEndPx: regionEnds(blocks),
      prefix: 'hg38',
    })
    expect(labels).toEqual([])
    expect(showPrefixFallback).toBe(true)
  })
})

describe('regionMoveActions', () => {
  test('single region: no moves offered', () => {
    expect(regionMoveActions(0, 1)).toEqual({
      canMoveLeft: false,
      canMoveRight: false,
      canMoveFarLeft: false,
      canMoveFarRight: false,
    })
  })

  test('two regions: only single steps, never "far" (would duplicate)', () => {
    expect(regionMoveActions(0, 2)).toEqual({
      canMoveLeft: false,
      canMoveRight: true,
      canMoveFarLeft: false,
      canMoveFarRight: false,
    })
    expect(regionMoveActions(1, 2)).toEqual({
      canMoveLeft: true,
      canMoveRight: false,
      canMoveFarLeft: false,
      canMoveFarRight: false,
    })
  })

  test('adjacent-to-end index suppresses the redundant "far" move', () => {
    // idx 1 of 3: "far left" (→0) would duplicate "left" (→0), so it's off;
    // "far right" (→2) would duplicate "right" (→2), so it's off too
    expect(regionMoveActions(1, 3)).toEqual({
      canMoveLeft: true,
      canMoveRight: true,
      canMoveFarLeft: false,
      canMoveFarRight: false,
    })
  })

  test('interior index with a gap to both ends offers all four', () => {
    expect(regionMoveActions(2, 5)).toEqual({
      canMoveLeft: true,
      canMoveRight: true,
      canMoveFarLeft: true,
      canMoveFarRight: true,
    })
  })
})
