import {
  getScalebarRefNameLabels,
  groupContiguousBlocks,
  refNameLabelFitsInView,
  runRefNameLabelPx,
  makeBlockTicks,
  parseLocStrings,
  makeOverviewTickLabels,
  makeOverviewTicks,
  makeTicks,
  regionMoveActions,
  regionsOrientation,
  tickLabelWidth,
  withRegionMoved,
  withRegionRemoved,
  withRegionReversed,
} from './util.ts'

import type { BlockRun, RegionsOrientation } from './util.ts'
import type { BaseBlock, ContentBlock } from '@jbrowse/core/util/blockTypes'

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

  // this loop is sized in bp, and chooseGridPitch bottoms out at a 5bp pitch
  // when handed a zero scale, so a chromosome-length region asked Array.from for
  // ~50M ticks. createOverviewLayout reports bpPerPx 0 for a zero-width overview
  test('a non-positive scale yields no ticks rather than tens of millions', () => {
    expect(makeOverviewTicks(0, 250_000_000, 0)).toEqual([])
    expect(makeOverviewTicks(0, 250_000_000, -1)).toEqual([])
    expect(makeOverviewTicks(0, 250_000_000, Number.NaN)).toEqual([])
  })
})

describe('makeOverviewTickLabels', () => {
  // one whole 10Mb region filling the overview: ticks every 1Mb / 200px
  const wide = { start: 0, end: 10_000_000, widthPx: 2000 }

  test('a wide block numbers every tick that fits inside it', () => {
    const labels = makeOverviewTickLabels({
      block: wide,
      bpPerPx: SCALE,
      refNameLabelPx: 0,
    })
    // the 10M tick sits exactly on the right edge, so its label would overrun
    expect(labels.map(l => l.label)).toEqual([
      '1M',
      '2M',
      '3M',
      '4M',
      '5M',
      '6M',
      '7M',
      '8M',
      '9M',
    ])
    expect(labels.map(l => l.offsetPx)).toEqual([
      200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800,
    ])
  })

  test('the refName label at the left edge wins over a tick underneath it', () => {
    const { offsetPx } = makeOverviewTickLabels({
      block: wide,
      bpPerPx: SCALE,
      refNameLabelPx: 0,
    })[0]!
    const labels = makeOverviewTickLabels({
      block: wide,
      bpPerPx: SCALE,
      refNameLabelPx: offsetPx + 1,
    })
    expect(labels.map(l => l.label)).toEqual([
      '2M',
      '3M',
      '4M',
      '5M',
      '6M',
      '7M',
      '8M',
      '9M',
    ])
  })

  test('a narrow block holding one lone number shows none', () => {
    // 4Mb of the region, wide enough for the 1M tick label to fit (it clears
    // widthPx by more than tickLabelWidth) but with no second tick to pair it
    const labelWidth = tickLabelWidth('1M')
    const widthPx = 200 + labelWidth + 10
    expect(
      makeOverviewTickLabels({
        block: { start: 0, end: widthPx * SCALE, widthPx },
        bpPerPx: SCALE,
        refNameLabelPx: 0,
      }),
    ).toEqual([])
  })

  test('a block too narrow for any tick shows none', () => {
    expect(
      makeOverviewTickLabels({
        block: { start: 1_100_000, end: 1_900_000, widthPx: 160 },
        bpPerPx: SCALE,
        refNameLabelPx: 0,
      }),
    ).toEqual([])
  })

  test('reversed block numbers from the right', () => {
    const labels = makeOverviewTickLabels({
      block: { ...wide, reversed: true },
      bpPerPx: SCALE,
      refNameLabelPx: 0,
    })
    expect(labels.map(l => l.label)).toEqual([
      '9M',
      '8M',
      '7M',
      '6M',
      '5M',
      '4M',
      '3M',
      '2M',
      '1M',
    ])
    expect(labels.map(l => l.offsetPx)).toEqual([
      200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800,
    ])
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

  // Major ticks carry the scalebar's coordinate labels, so their pitch is what
  // the reader sees as "the numbers go up by N". Marking majors at two
  // chooseGridPitch pitches instead of one used to yield 4×10ⁿ — a scalebar
  // numbered 4000/8000/12000, which reads as an arbitrary interval next to the
  // 5000/10000/15000 every other ruler in the app shows.
  test.each([0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 1000, 5000])(
    'major pitch stays on the 1/2/5 ladder at %p bp/px',
    bpPerPx => {
      // A 5000px-wide region at whatever scale is being asked about, rather
      // than a fixed 100Mb one. `makeTicks` steps by the MINOR pitch even when
      // it emits no minors, so a span in bp costs an iteration per ~15px of it:
      // 100Mb at 0.05bp/px walked 100M of them for the two majors read below,
      // and this suite spent 25 of its 27 seconds there.
      const majors = makeTicks(0, bpPerPx * 5000, bpPerPx, true, false)
        .map(t => t.base + 1)
        .filter(base => base > 0)
      const pitch = majors[1]! - majors[0]!
      // 1, 2 or 5 times a power of ten
      const mantissa = pitch / 10 ** Math.floor(Math.log10(pitch))
      expect([1, 2, 5]).toContain(Math.round(mantissa))
      // and spaced for reading: wide enough that a coordinate label fits
      expect(pitch / bpPerPx).toBeGreaterThanOrEqual(120)
    },
  )
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
  ): ContentBlock => ({
    type: 'ContentBlock',
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
      {
        offsetPx: 0,
        widthPx: 1600,
        start: 0,
        end: 1600,
        reversed: false,
        refName: 'ctgA',
        isLeftEndOfDisplayedRegion: false,
      },
    ])
  })

  test('a run reports its first block, not a later chunk of the same region', () => {
    // the ~800px chunks after the first are interior to the region: a run that
    // took isLeftEndOfDisplayedRegion from the last block it merged would
    // forget that the region starts here
    const runs = groupContiguousBlocks([
      { ...block(0, 0, 800, 0), isLeftEndOfDisplayedRegion: true },
      block(0, 800, 1600, 800),
    ])
    expect(runs[0]!.isLeftEndOfDisplayedRegion).toBe(true)
  })

  test('a new region starts a new run (no separator block between them)', () => {
    const runs = groupContiguousBlocks([
      block(0, 0, 800, 0),
      block(1, 0, 500, 800),
    ])
    expect(runs).toEqual([
      {
        offsetPx: 0,
        widthPx: 800,
        start: 0,
        end: 800,
        reversed: false,
        refName: 'ctgA',
        isLeftEndOfDisplayedRegion: false,
      },
      {
        offsetPx: 800,
        widthPx: 500,
        start: 0,
        end: 500,
        reversed: false,
        refName: 'ctgA',
        isLeftEndOfDisplayedRegion: false,
      },
    ])
  })

  test('an elided/padding block breaks a run', () => {
    const runs = groupContiguousBlocks([
      block(0, 0, 800, 0),
      {
        type: 'InterRegionPaddingBlock',
        key: 'pad',
        widthPx: 3,
        offsetPx: 800,
      },
      block(0, 800, 1600, 803),
    ])
    expect(runs).toHaveLength(2)
  })
})

describe('runRefNameLabelPx', () => {
  const run = (
    refName: string,
    isLeftEndOfDisplayedRegion: boolean,
    reversed = false,
  ): BlockRun => ({
    offsetPx: 0,
    widthPx: 800,
    start: 0,
    end: 800,
    reversed,
    refName,
    isLeftEndOfDisplayedRegion,
  })

  test('reserves the padding plus the measured bold name', () => {
    // 7px inset clearing the region divider, then "ctgB" at 11px bold (23.06)
    const [px] = runRefNameLabelPx([run('ctgB', true)])
    expect(px).toBeCloseTo(30.06, 1)
  })

  test('a run that gets no label reserves nothing', () => {
    // interior of a region the view is scrolled into: no divider, no label, so
    // holding space there would drop a coordinate for nothing
    expect(runRefNameLabelPx([run('ctgB', false)])).toEqual([0])
  })

  test('collapsed introns reserve only at the first run of a name', () => {
    // many adjacent regions of one refName: the name is drawn once, so only
    // that run gives up the space
    const px = runRefNameLabelPx([
      run('ctgA', true),
      run('ctgA', true),
      run('ctgB', true),
    ])
    expect(px[0]).toBeGreaterThan(0)
    expect(px[1]).toBe(0)
    expect(px[2]).toBeGreaterThan(0)
  })

  // under mixed orientation a reversed run's label carries " [rev]", so the
  // numbers have that much more to stay clear of. Under a uniformly reversed
  // row only the pinned label is marked, and that one is dodged on screen
  // instead — its x is a function of the scroll, not of this frame
  test('a mixed row reserves the marker too, and only there', () => {
    const marked = runRefNameLabelPx([run('ctgB', true, true)], 'mixed')
    const plain = runRefNameLabelPx([run('ctgB', true, true)], 'reversed')
    expect(plain[0]).toBeCloseTo(30.06, 1)
    expect(marked[0]! - plain[0]!).toBeGreaterThan(20)
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
  reversed = false,
}: {
  key: string
  refName: string
  displayedRegionIndex: number
  offsetPx: number
  widthPx: number
  isLeftEndOfDisplayedRegion?: boolean
  reversed?: boolean
}): ContentBlock {
  return {
    type: 'ContentBlock',
    key,
    assemblyName: 'volvox',
    refName,
    start: 0,
    end: widthPx,
    offsetPx,
    widthPx,
    displayedRegionIndex,
    isLeftEndOfDisplayedRegion,
    reversed,
  }
}

describe('the sticky label picks its run', () => {
  const stickyLabel = (blocks: BaseBlock[], offsetPx: number) =>
    getScalebarRefNameLabels({
      blocks,
      offsetPx,
      prefix: undefined,
    }).labels.find(l => l.sticky)

  test('no content blocks yields no labels', () => {
    expect(stickyLabel([], 0)).toBeUndefined()
  })

  test('nothing scrolled off the left pins the first run', () => {
    const blocks = [
      refBlock({
        key: 'a',
        refName: 'c1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
      refBlock({
        key: 'b',
        refName: 'c1',
        displayedRegionIndex: 0,
        offsetPx: 800,
        widthPx: 800,
      }),
    ]
    expect(stickyLabel(blocks, 0)!.key).toBe('a')
  })

  test('picks the rightmost run whose left edge is off the left of the viewport', () => {
    const blocks = ['c1', 'c2', 'c3'].map((refName, i) =>
      refBlock({
        key: refName,
        refName,
        displayedRegionIndex: i,
        offsetPx: i * 800,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
    )
    expect(stickyLabel(blocks, 1000)!.key).toBe('c2')
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
    const { labels, caption } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      prefix: '',
    })
    expect(caption).toBeUndefined()
    expect(labels).toEqual([
      {
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        lastDisplayedRegionIndex: 0,
        sticky: true,
        transform: 0,
        maxWidth: 1599,
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
    const { labels, caption } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      prefix: 'hg38',
    })
    expect(caption).toBeUndefined()
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
      prefix: '',
    })
    expect(labels.map(l => l.key)).toEqual(['a'])
  })

  test('scrolled past a region: only the sticky label, no offscreen-left twin', () => {
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
      prefix: '',
    })
    // both blocks are one chr1 run, which has scrolled past its own left edge,
    // so the run gets a single label pinned to the viewport edge rather than a
    // second one drawn off-canvas at the edge it no longer has on screen
    expect(labels.map(l => ({ key: l.key, transform: l.transform }))).toEqual([
      { key: 'a', transform: 0 },
    ])
  })

  test('a region scrolled entirely off the left drops its label, even with its own refName', () => {
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
        refName: 'chr2',
        displayedRegionIndex: 1,
        offsetPx: 800,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
    ]
    const { labels } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 900,
      prefix: '',
    })
    expect(labels.map(l => l.refName)).toEqual(['chr2'])
  })

  test('left-overscroll (offsetPx<0) clips sticky label at its region end, not viewport', () => {
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
      offsetPx: -50,
      prefix: '',
    })
    // pinned at the run's left edge (screen 50), so available width runs from
    // frame-x 0 to the run end 1600 → 1599, never the over-counted 1600-(-50)-1
    expect(labels).toEqual([
      {
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        lastDisplayedRegionIndex: 0,
        sticky: true,
        transform: 50,
        maxWidth: 1599,
        paddingLeft: 0,
        text: 'chr1',
      },
    ])
  })

  test('left-overscroll with a prefix: sticky label keeps the bare refName, prefix goes standalone', () => {
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
    const { labels, caption } = getScalebarRefNameLabels({
      blocks,
      offsetPx: -300,
      prefix: 'hg38',
    })
    // the label is out at the region's left edge (screen 300), nowhere near the
    // assembly name pinned at 0, so folding them into one string would leave the
    // viewport's left edge unlabeled — the row would not say which assembly it
    // is, while a neighboring row whose first region starts at 0 would
    expect(labels[0]!.text).toBe('chr1')
    expect(labels[0]!.transform).toBe(300)
    expect(caption).toBe('hg38')
  })

  test('slight left-overscroll: sticky label still absorbs the prefix it would overlap', () => {
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
    const { labels, caption } = getScalebarRefNameLabels({
      blocks,
      offsetPx: -5,
      prefix: 'hg38',
    })
    expect(labels[0]!.text).toBe('hg38:chr1')
    expect(caption).toBeUndefined()
  })

  test('the sticky label unfolds only once it clears the standalone chip', () => {
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
    const textAt = (offsetPx: number) =>
      getScalebarRefNameLabels({
        blocks,
        offsetPx,
        prefix: 'hg38',
      }).labels[0]!.text
    // "hg38" is ~25.6px wide and a sticky label carries no padding of its own,
    // so at a transform of 27 the two would sit a glyph-and-a-half apart and
    // read as "hg38chr1" — keep folding until there's real clearance
    expect(textAt(-27)).toBe('hg38:chr1')
    expect(textAt(-30)).toBe('chr1')
  })

  // a second region of the given pixel width, following a wide chr1
  function withSecondRegion(refName: string, widthPx: number) {
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
        refName,
        displayedRegionIndex: 1,
        offsetPx: 800,
        widthPx,
        isLeftEndOfDisplayedRegion: true,
      }),
    ]
    return getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      prefix: '',
    }).labels
  }

  test('a short name is labeled in a region too narrow for a long one', () => {
    // 20px of region holds "X" but not "chr22" — the old flat 20px floor hid
    // both, which at whole-genome zoom drops the numbering off every small
    // chromosome even though the digits would have fit
    expect(withSecondRegion('X', 20).map(l => l.refName)).toEqual(['chr1', 'X'])
    expect(withSecondRegion('chr22', 20).map(l => l.refName)).toEqual(['chr1'])
  })

  test('maxWidth is the whole label box, so the fit test has to pay paddingLeft', () => {
    const [, label] = withSecondRegion('X', 20)
    // maxWidth spans the region, padding included: both consumers clip from the
    // box's own left edge (a border-box max-width, an SVG clip rect at x=0), so
    // taking paddingLeft off it here as well would spend those 7px twice and
    // clip the name it was just measured to fit
    expect(label!.maxWidth).toBe(20)
    expect(label!.paddingLeft).toBe(7)
    // "X" is 7.7px wide and 20 - 7 = 13px are left for it, but at 14px of
    // region the padding leaves 7 and the name no longer fits
    expect(withSecondRegion('X', 14).map(l => l.refName)).toEqual(['chr1'])
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
    const { labels, caption } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      prefix: 'hg38',
    })
    expect(labels).toEqual([])
    expect(caption).toBe('hg38')
  })

  test('a label fitted to its region can still overrun the view edge', () => {
    // chr14 starts 20px before the right edge of an 820px view, inside a region
    // 800px wide: it clears the region fit by a mile and is still cut in half by
    // the viewport. The SVG export drops it on that second test; on screen it
    // stays, as a name you scroll the rest of into frame
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
        refName: 'chr14',
        displayedRegionIndex: 1,
        offsetPx: 800,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
    ]
    const { labels } = getScalebarRefNameLabels({
      blocks,
      offsetPx: 0,
      prefix: '',
    })
    const [chr1, chr14] = labels
    expect(chr14!.refName).toBe('chr14')
    expect(refNameLabelFitsInView(chr14!, 820)).toBe(false)
    // 7px of padding plus ~29px of "chr14" need the view to reach ~836
    expect(refNameLabelFitsInView(chr14!, 840)).toBe(true)
    expect(refNameLabelFitsInView(chr1!, 820)).toBe(true)
  })

  // A run of one refName is deduped so collapsed introns don't repeat the name
  // at every region boundary. An elided block between two of them is not that
  // case: it stands for whole chromosomes squeezed out of the layout, so the
  // name on its far side is a fresh region, and leaving it unlabeled reads as
  // one long chr1 with a grey stripe through it.
  test('an elided run between two same-name regions ends the run', () => {
    const same = (i: number, offsetPx: number) =>
      refBlock({
        key: `r${i}`,
        refName: 'chr1',
        displayedRegionIndex: i,
        offsetPx,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      })
    const args = {
      offsetPx: 0,
      prefix: '',
    }

    const adjacent = [same(0, 0), same(1, 800)]
    expect(
      getScalebarRefNameLabels({
        ...args,
        blocks: adjacent,
      }).labels.map(l => l.key),
    ).toEqual(['r0'])

    const separated = [
      same(0, 0),
      { type: 'ElidedBlock' as const, key: 'e', offsetPx: 800, widthPx: 3 },
      same(2, 803),
    ]
    expect(
      getScalebarRefNameLabels({
        ...args,
        blocks: separated,
      }).labels.map(l => l.key),
    ).toEqual(['r0', 'r2'])
  })

  // Collapsed introns lay one chromosome out as many adjacent regions, and the
  // dedupe above gives the lot a single label. Fitting that label to the FIRST
  // region's width dropped it whenever the exon under the viewport's left edge
  // was narrow, so the chromosome name blinked out around every internal region
  // boundary — 30px of every 100 here — with nothing left naming the row.
  describe('a run of same-name regions is fitted to the whole run', () => {
    const blocks = Array.from({ length: 8 }, (_, i) =>
      refBlock({
        key: `r${i}`,
        refName: 'chr1',
        displayedRegionIndex: i,
        offsetPx: i * 100,
        widthPx: 100,
        isLeftEndOfDisplayedRegion: true,
      }),
    )
    const labelsAt = (offsetPx: number) =>
      getScalebarRefNameLabels({ blocks, offsetPx, prefix: undefined }).labels

    test('the name survives every scroll position across the run', () => {
      for (let offsetPx = 0; offsetPx <= 700; offsetPx += 10) {
        expect(labelsAt(offsetPx).map(l => l.text)).toEqual(['chr1'])
      }
    })

    test('width runs to the end of the run, not the end of one region', () => {
      // 80px into a 100px region, the region itself leaves 19px — less than
      // "chr1" needs — while the run leaves 719
      expect(labelsAt(80)[0]!.maxWidth).toBe(719)
    })

    test('the label brackets the regions it stands for', () => {
      const [label] = labelsAt(250)
      expect(label!.displayedRegionIndex).toBe(0)
      expect(label!.lastDisplayedRegionIndex).toBe(7)
    })
  })
})

describe('the [rev] marker', () => {
  // two chromosomes, each 800px, the second flipped
  const blocks = (revA: boolean, revB: boolean) => [
    refBlock({
      key: 'a',
      refName: 'chr1',
      displayedRegionIndex: 0,
      offsetPx: 0,
      widthPx: 800,
      isLeftEndOfDisplayedRegion: true,
      reversed: revA,
    }),
    refBlock({
      key: 'b',
      refName: 'chr2',
      displayedRegionIndex: 1,
      offsetPx: 800,
      widthPx: 800,
      isLeftEndOfDisplayedRegion: true,
      reversed: revB,
    }),
  ]
  const drawn = (
    orientation: RegionsOrientation,
    revA = false,
    revB = false,
    prefix?: string,
  ) => {
    const { labels, caption } = getScalebarRefNameLabels({
      blocks: blocks(revA, revB),
      offsetPx: 0,
      prefix,
      orientation,
    })
    return { caption, texts: labels.map(l => l.text) }
  }

  test('a forward row says nothing', () => {
    expect(drawn('forward')).toEqual({
      caption: undefined,
      texts: ['chr1', 'chr2'],
    })
  })

  // the whole point of the rule: a flipped whole-genome row would otherwise
  // repeat [rev] after all 24 chromosomes to say one thing about the row
  test('a wholly flipped row says it once, and on no chromosome name', () => {
    expect(drawn('reversed', true, true)).toEqual({
      caption: '[rev]',
      texts: ['chr1', 'chr2'],
    })
  })

  // the two states must not render alike: the caption is the row, a marker on
  // a name is that region
  test('a mixed row marks the flipped region, where it tells them apart', () => {
    expect(drawn('mixed', false, true)).toEqual({
      caption: undefined,
      texts: ['chr1', 'chr2 [rev]'],
    })
  })

  test('the caption carries the assembly name with it', () => {
    expect(drawn('reversed', true, true, 'volvox').caption).toBe('volvox [rev]')
  })

  test('a flipped row does not fold its assembly name into the sticky label', () => {
    // folding would put the marker back on a name — "volvox:chr1 [rev]" — which
    // is how the mixed case spells one region
    const { texts } = drawn('reversed', true, true, 'volvox')
    expect(texts[0]).toBe('chr1')
  })

  test('the pinned label starts clear of the caption it must not overlap', () => {
    const { labels } = getScalebarRefNameLabels({
      blocks: blocks(true, true),
      offsetPx: 0,
      prefix: undefined,
      orientation: 'reversed',
    })
    const { labels: forward } = getScalebarRefNameLabels({
      blocks: blocks(false, false),
      offsetPx: 0,
      prefix: undefined,
      orientation: 'forward',
    })
    expect(forward[0]!.transform).toBe(0)
    expect(labels[0]!.transform).toBeGreaterThan(25)
  })

  // widening the text moves the width a name needs from ~30px to ~56px, and a
  // marker that deletes chromosome names in that gap surfaces nothing
  test('a mixed label too narrow for the marker keeps its name and drops it', () => {
    const narrow = [
      refBlock({
        key: 'a',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 40,
        isLeftEndOfDisplayedRegion: true,
        reversed: true,
      }),
    ]
    const { labels } = getScalebarRefNameLabels({
      blocks: narrow,
      offsetPx: 0,
      prefix: undefined,
      orientation: 'mixed',
    })
    expect(labels.map(l => l.text)).toEqual(['chr1'])
  })

  // one label carries one direction, so a marker always means the whole of what
  // it sits on
  test('an orientation change splits a run of one refName', () => {
    const split = [
      refBlock({
        key: 'f',
        refName: 'chr1',
        displayedRegionIndex: 0,
        offsetPx: 0,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
      }),
      refBlock({
        key: 'r',
        refName: 'chr1',
        displayedRegionIndex: 1,
        offsetPx: 800,
        widthPx: 800,
        isLeftEndOfDisplayedRegion: true,
        reversed: true,
      }),
    ]
    expect(
      getScalebarRefNameLabels({
        blocks: split,
        offsetPx: 0,
        prefix: undefined,
        orientation: 'mixed',
      }).labels.map(l => l.text),
    ).toEqual(['chr1', 'chr1 [rev]'])
  })
})

describe('regionsOrientation', () => {
  test('empty is forward', () => {
    expect(regionsOrientation([])).toBe('forward')
  })

  test('every region flipped is reversed, none is forward', () => {
    expect(regionsOrientation([{ reversed: true }, { reversed: true }])).toBe(
      'reversed',
    )
    expect(regionsOrientation([{}, { reversed: false }])).toBe('forward')
  })

  test('disagreement is mixed, whichever way round', () => {
    expect(regionsOrientation([{ reversed: true }, {}])).toBe('mixed')
    expect(regionsOrientation([{}, { reversed: true }])).toBe('mixed')
  })
})

describe('regionMoveActions', () => {
  test('single region: no moves offered', () => {
    expect(regionMoveActions(0, 1)).toEqual([])
  })

  test('two regions: only single steps, never "far" (would duplicate)', () => {
    expect(regionMoveActions(0, 2)).toEqual([{ label: 'Move right', to: 1 }])
    expect(regionMoveActions(1, 2)).toEqual([{ label: 'Move left', to: 0 }])
  })

  test('adjacent-to-end index suppresses the redundant "far" move', () => {
    // idx 1 of 3: "far left" (→0) would duplicate "left" (→0), so it's off;
    // "far right" (→2) would duplicate "right" (→2), so it's off too
    expect(regionMoveActions(1, 3)).toEqual([
      { label: 'Move left', to: 0 },
      { label: 'Move right', to: 2 },
    ])
  })

  test('interior index with a gap to both ends offers all four', () => {
    expect(regionMoveActions(2, 5)).toEqual([
      { label: 'Move left', to: 1 },
      { label: 'Move right', to: 3 },
      { label: 'Move to far left', to: 0 },
      { label: 'Move to far right', to: 4 },
    ])
  })
})

describe('region list transforms', () => {
  const regions = ['a', 'b', 'c'].map(refName => ({
    refName,
    start: 0,
    end: 100,
    assemblyName: 'volvox',
  }))

  test('withRegionMoved rotates one region into its new slot', () => {
    expect(withRegionMoved(regions, 2, 0).map(r => r.refName)).toEqual([
      'c',
      'a',
      'b',
    ])
    expect(withRegionMoved(regions, 0, 1).map(r => r.refName)).toEqual([
      'b',
      'a',
      'c',
    ])
    // the source list is never mutated: the menu reads model.displayedRegions
    expect(regions.map(r => r.refName)).toEqual(['a', 'b', 'c'])
  })

  test('withRegionRemoved drops just that index', () => {
    expect(withRegionRemoved(regions, 1).map(r => r.refName)).toEqual([
      'a',
      'c',
    ])
  })

  test('withRegionReversed flips one region and leaves the rest alone', () => {
    const flipped = withRegionReversed(regions, 1)
    expect(flipped.map(r => r.reversed)).toEqual([undefined, true, undefined])
    // flipping twice returns to forward, not to `undefined`
    expect(withRegionReversed(flipped, 1)[1]!.reversed).toBe(false)
  })
})

describe('parseLocStrings', () => {
  const isValidRefName = (refName: string) => ['chr1', 'chr2'].includes(refName)

  test('parses a colon-form locString with unit suffixes', () => {
    expect(parseLocStrings('chr1:34M-35M', 'hg38', isValidRefName)).toEqual([
      { refName: 'chr1', start: 33_999_999, end: 35_000_000, reversed: false },
    ])
  })

  test('parses several space-separated locStrings', () => {
    expect(
      parseLocStrings('chr1:1M-2M chr2:1-100', 'hg38', isValidRefName),
    ).toEqual([
      { refName: 'chr1', start: 999_999, end: 2_000_000, reversed: false },
      { refName: 'chr2', start: 0, end: 100, reversed: false },
    ])
  })

  // the refName/start/end triplet is a separate fallback path, reached only
  // once the whole-string parse has thrown UnknownRefNameError, so it needs its
  // own coverage of the spellings the colon form accepts
  test.each([
    ['chr1 34000000 35000000'],
    ['chr1 34M 35M'],
    ['chr1 34,000,000 35,000,000'],
  ])('%p is the same triplet', input => {
    expect(parseLocStrings(input, 'hg38', isValidRefName)).toEqual([
      { refName: 'chr1', start: 33_999_999, end: 35_000_000, reversed: false },
    ])
  })

  test('a triplet whose coordinates are not bp quantities still throws', () => {
    expect(() => {
      parseLocStrings('chr1 foo bar', 'hg38', isValidRefName)
    }).toThrow()
  })

  test('an unknown refName throws rather than falling through', () => {
    expect(() => {
      parseLocStrings('chr3:1M-2M', 'hg38', isValidRefName)
    }).toThrow()
  })
})
