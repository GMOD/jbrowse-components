import { measureText } from '@jbrowse/core/util'

import { Dotplot1DView } from '../1dview.ts'
import {
  AXIS_TITLE_FONT,
  axisBorderPx,
  fitAxisTitle,
  getBlockLabelKeysToHide,
  locstr,
  makeTicks,
  regionBoundaryLines,
  thinTickPositions,
  tickKey,
  tickLines,
  truncateRefName,
  truncateRefNames,
} from './util.ts'

import type { Tick } from './util.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

function region(refName: string, end: number, start = 0) {
  return { refName, start, end }
}

// the model hands axisBorderPx the same label map its axis component draws from
// (h/vRefNameLabels); pair the two here so a test can't measure the margin
// against a string the axis would never print
function border(
  regions: { refName: string; start: number; end: number }[],
  bpPerPx: number,
) {
  return axisBorderPx(
    regions,
    bpPerPx,
    truncateRefNames(regions.map(r => r.refName)),
  )
}

// a static block, which is 1000 CSS px of the region rather than the whole of it
function staticBlock(
  start: number,
  end: number,
  isLeftEndOfDisplayedRegion = false,
  displayedRegionIndex = 0,
): ContentBlock {
  return {
    type: 'ContentBlock',
    key: `ctgA:${start}-${end}:${displayedRegionIndex}`,
    offsetPx: start,
    widthPx: end - start,
    assemblyName: 'volvox',
    refName: 'ctgA',
    start,
    end,
    isLeftEndOfDisplayedRegion,
    displayedRegionIndex,
  }
}

// label position along the axis is `round(length - offsetPx + viewOffsetPx)`;
// each label occupies the 12px ending at that position.
function posBlock(key: string, offsetPx: number, len: number): ContentBlock {
  return {
    type: 'ContentBlock',
    key,
    offsetPx,
    widthPx: 100,
    assemblyName: 'a',
    refName: key,
    start: 0,
    end: len,
  }
}

describe('truncateRefName', () => {
  test('short names pass through unchanged', () => {
    expect(truncateRefName('chr1')).toBe('chr1')
    expect(truncateRefName('scaffold9')).toBe('scaffold9')
  })

  // a name no wider than the tick coordinates beside it is not worth eliding
  test('an ordinary-length name is not elided', () => {
    expect(truncateRefName('scaffold_1234')).toBe('scaffold_1234')
    expect(truncateRefName('chr1_MATERNAL')).toBe('chr1_MATERNAL')
  })

  test('long names are middle-elided, keeping prefix and suffix', () => {
    expect(truncateRefName('scaffold_123456')).toBe('scaffo…123456')
  })
})

describe('truncateRefNames', () => {
  test('elides while the short forms stay distinct', () => {
    const labels = truncateRefNames([
      'scaffold_123456',
      'scaffold_567890',
      'chr1',
    ])
    expect(labels.get('scaffold_123456')).toBe('scaffo…123456')
    expect(labels.get('scaffold_567890')).toBe('scaffo…567890')
    expect(labels.get('chr1')).toBe('chr1')
  })

  test('keeps full names when the elide would collide', () => {
    // The haplotype-resolved case: the elide preserves `chromo` and `TERNAL`,
    // which is the boilerplate, and cuts the chromosome number, which is the
    // name. chromosome1 and chromosome10..19 all land on `chromo…TERNAL`.
    const names = [
      'chromosome1_MATERNAL',
      'chromosome10_MATERNAL',
      'chromosome2_MATERNAL',
    ]
    expect(names.map(truncateRefName)).toEqual([
      'chromo…TERNAL',
      'chromo…TERNAL',
      'chromo…TERNAL',
    ])
    const labels = truncateRefNames(names)
    for (const n of names) {
      expect(labels.get(n)).toBe(n)
    }
  })

  test('one collision keeps the whole axis full, not just the pair', () => {
    // A half-elided axis reads as arbitrary, and the margin is sized to the
    // widest label regardless, so there is nothing to win by mixing.
    const labels = truncateRefNames([
      'chromosome1_MATERNAL',
      'chromosome10_MATERNAL',
      'scaffold_123456',
    ])
    expect(labels.get('scaffold_123456')).toBe('scaffold_123456')
  })

  test('a repeated refName is not a collision', () => {
    // gatherOverlaps can put one refName on the axis twice (a read aligned
    // twice to one chromosome); that is the same name, not two names sharing a
    // label, and must not cost the axis its elide.
    const labels = truncateRefNames(['scaffold_123456', 'scaffold_123456'])
    expect(labels.get('scaffold_123456')).toBe('scaffo…123456')
  })
})

describe('fitAxisTitle', () => {
  test('a title that fits is left alone', () => {
    expect(fitAxisTitle('hg38', 400)).toBe('hg38')
  })

  test('a read-vs-ref synthetic assembly name is elided to fit its axis', () => {
    // <36-char ONT read id>_assembly_<13-digit stamp>: ~230px at font 11,
    // wider than a short axis, and centered text clips at both ends.
    const title = `0f2a1b3c-4d5e-6f70-8192-a3b4c5d6e7f8_assembly_1700000000000`
    const fitted = fitAxisTitle(title, 120)
    expect(fitted).not.toBe(title)
    expect(fitted).toContain('…')
    expect(measureText(fitted, AXIS_TITLE_FONT)).toBeLessThanOrEqual(120)
    // both ends survive: the read id's head and the stamp's tail
    expect(fitted.startsWith('0f2a')).toBe(true)
    expect(fitted.endsWith('0000')).toBe(true)
  })

  test('an axis with essentially no room still yields a nameable stub', () => {
    expect(fitAxisTitle('a_long_assembly_name', 1)).toBe('a_long…y_name')
  })
})

describe('locstr', () => {
  function axis(reversed: boolean) {
    const view = Dotplot1DView.create({
      bpPerPx: 1,
      offsetPx: 0,
      displayedRegions: [
        {
          assemblyName: 'volvox',
          refName: 'ctgA',
          start: 0,
          end: 1000,
          reversed,
        },
      ],
    })
    view.setVolatileWidth(500)
    return view
  }

  // 1-based, the same convention the ruler above it labels its ticks in: the
  // tick at this pixel says 101, not 100.
  test('a forward region reads left to right', () => {
    expect(locstr(100, axis(false))).toBe('{volvox}ctgA:101')
  })

  // auto-diagonalize flips query regions, so the vertical axis routinely has
  // them. `offset` is bp from the region's LEFT SCREEN EDGE, which is its `end`
  // when reversed — reading it as `start + offset` named bp 100 here, a
  // position mirrored about the middle of the right contig.
  test('a reversed region reads right to left', () => {
    expect(locstr(100, axis(true))).toBe('{volvox}ctgA:901')
  })

  test('past the last region it says so rather than extrapolating', () => {
    expect(locstr(1200, axis(false))).toBe('out of bounds')
  })
})

describe('axisBorderPx', () => {
  test('empty regions fall back to the minimum border', () => {
    expect(border([], 1)).toBe(50)
  })

  test('the widest region label drives the border', () => {
    const short = border([region('chr1', 1_000)], 1)
    const long = border(
      [region('chr1', 1_000), region('a_long_scaffold_name', 1_000)],
      1,
    )
    expect(long).toBeGreaterThan(short)
  })

  test('a truncated long name does not grow the border without bound', () => {
    // both names truncate to the same 13-char display, so the border matches
    expect(border([region('scaffold_1234_extra', 1_000)], 1)).toBe(
      border([region('scaffold_9999_extra', 1_000)], 1),
    )
  })

  test('a region too small to show a label does not inflate the border', () => {
    const bpPerPx = 1_000_000 // chr1 spans 20px; the contig spans 0.5px
    const withContig = border(
      [
        region('chr1', 20_000_000),
        region('chr1_random_unplaced', 20_500_000, 20_000_000),
      ],
      bpPerPx,
    )
    const chr1Only = border([region('chr1', 20_000_000)], bpPerPx)
    expect(withContig).toBe(chr1Only)
  })

  test('bpPerPx changes tick-label precision and so the border', () => {
    // "1,234,567" (bpPerPx=1) is a wider tick than "1.23M" (bpPerPx=1000);
    // both spans stay above LABEL_PX so the filter keeps them
    const fine = border([region('chr1', 1_234_567)], 1)
    const coarse = border([region('chr1', 1_234_567)], 1_000)
    expect(fine).toBeGreaterThan(coarse)
  })

  // the elide is off when it would collide, so the margin has to grow with it:
  // sized off `chromo…TERNAL` while the axis prints the full name, every label on
  // a haplotype-resolved assembly is clipped
  test('a colliding elide set widens the border to the full names', () => {
    const haplotype = [
      region('chromosome1_MATERNAL', 1_000),
      region('chromosome10_MATERNAL', 1_000),
    ]
    const distinct = [
      region('scaffold_123456', 1_000),
      region('scaffold_567890', 1_000),
    ]
    expect(border(haplotype, 1)).toBeGreaterThan(border(distinct, 1))
  })
})

describe('makeTicks', () => {
  test('a static-block seam does not emit its ticks twice', () => {
    // the seam bp is not pitch-aligned, so the first block's loop overshoots it
    // and the second block's starts below it — the overlap used to ship two
    // <line>s at the same position, drawn out of order
    const bases = makeTicks(
      [staticBlock(12_000, 22_345), staticBlock(22_345, 32_345)],
      20,
    ).map(t => t.base)
    // one uniform pitch step throughout: a repeated tick shows up as a 0 step,
    // a dropped one as a doubled step
    const steps = new Set(bases.slice(1).map((base, i) => base - bases[i]!))
    expect([...steps]).toHaveLength(1)
  })

  test('only a region left end suppresses the major tick under its refName label', () => {
    const interior = makeTicks([staticBlock(0, 10_000)], 20).map(t => t.base)
    const leftEnd = makeTicks([staticBlock(0, 10_000, true)], 20).map(
      t => t.base,
    )
    expect(interior).toContain(-1)
    expect(leftEnd).not.toContain(-1)
    expect(leftEnd).toHaveLength(interior.length - 1)
  })

  // An axis can show the same refName in more than one displayed region — a
  // read-vs-ref dotplot's h axis comes from gatherOverlaps, so a read aligned
  // twice to one chromosome yields two regions on it. Keyed on refName alone,
  // the second region's ticks were deduped away as if they were the first
  // region's, positioned against the first region by bpToPx, and handed React a
  // duplicate key.
  test('the same refName in two displayed regions keeps both sets of ticks', () => {
    const one = makeTicks([staticBlock(0, 10_000, false, 0)], 20)
    const two = makeTicks(
      [staticBlock(0, 10_000, false, 0), staticBlock(0, 10_000, false, 1)],
      20,
    )
    expect(two).toHaveLength(one.length * 2)
    expect(new Set(two.map(tickKey)).size).toBe(two.length)
    expect(two.filter(t => t.displayedRegionIndex === 1)).toHaveLength(
      one.length,
    )
  })

  test('the seam between two static blocks of one region still dedupes', () => {
    const bases = makeTicks(
      [
        staticBlock(12_000, 22_345, false, 3),
        staticBlock(22_345, 32_345, false, 3),
      ],
      20,
    ).map(t => t.base)
    const steps = new Set(bases.slice(1).map((base, i) => base - bases[i]!))
    expect([...steps]).toHaveLength(1)
  })
})

// A tick's axis position used to come from `bpToPx`, a linear scan of
// displayedRegions per tick; it now comes from the block that generated the
// tick, in O(1). The two have to agree exactly — including across a region
// boundary, on a reversed region (which lays out right-to-left), and for the
// seam ticks whose base overshoots their own block but is still in the region.
describe('makeTicks px agrees with bpToPx', () => {
  function axis(bpPerPx: number, offsetPx: number) {
    const view = Dotplot1DView.create({
      bpPerPx,
      offsetPx,
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 200_000 },
        {
          assemblyName: 'volvox',
          refName: 'ctgB',
          start: 5_000,
          end: 300_000,
          reversed: true,
        },
        { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 150_000 },
      ],
    })
    view.setVolatileWidth(800)
    return view
  }

  test.each([
    [100, 0],
    [100, 2_000],
    [10, 3_500],
    [1, 0],
  ])('bpPerPx %p, offsetPx %p', (bpPerPx, offsetPx) => {
    const view = axis(bpPerPx, offsetPx)
    const ticks = makeTicks(view.staticBlocks.contentBlocks, view.bpPerPx)
    expect(ticks.length).toBeGreaterThan(5)
    for (const tick of ticks) {
      expect(tick.px).toBe(
        view.bpToPx({
          refName: tick.refName,
          coord: tick.base,
          displayedRegionIndex: tick.displayedRegionIndex,
        }),
      )
    }
  })
})

describe('thinTickPositions', () => {
  function tick(type: 'major' | 'minor', base: number): Tick {
    return { type, base, refName: 'ctgA', displayedRegionIndex: 0 }
  }
  const at = (type: 'major' | 'minor', alongPx: number) => ({
    tick: tick(type, alongPx),
    alongPx,
  })

  // chooseGridPitch targets 15px minors and 60px majors within one region, so
  // an ordinary single-region axis must come through untouched — this is what
  // makes always generating ticks safe where the old block-count cutoff used to
  // discard them.
  test('an ordinary ruler is left alone', () => {
    const input = [
      at('major', 0),
      at('minor', 15),
      at('minor', 30),
      at('minor', 45),
      at('major', 60),
    ]
    const out = thinTickPositions(input)
    expect(out.map(t => t.alongPx)).toEqual([0, 15, 30, 45, 60])
    expect(out.filter(t => t.labeled).map(t => t.alongPx)).toEqual([0, 60])
  })

  // Where regions meet, ticks from different coordinate origins land on top of
  // each other. Marks collapse to one per 4px, labels to one per font height.
  test('a pile-up at a region boundary is thinned', () => {
    const out = thinTickPositions([
      at('major', 100),
      at('major', 101),
      at('minor', 102),
      at('major', 103),
      at('major', 130),
    ])
    expect(out.map(t => t.alongPx)).toEqual([100, 130])
    expect(out.every(t => t.labeled)).toBe(true)
  })

  // A reversed region's ticks descend in alongPx, so an unsorted forward pass
  // would measure spacing across the turnaround and thin the wrong ones.
  test('descending input from a reversed region is handled', () => {
    const out = thinTickPositions([
      at('major', 60),
      at('major', 30),
      at('major', 0),
    ])
    expect(out.map(t => t.alongPx)).toEqual([0, 30, 60])
  })

  test('only major ticks are ever labeled', () => {
    const out = thinTickPositions([at('minor', 0), at('minor', 40)])
    expect(out.some(t => t.labeled)).toBe(false)
  })

  // The whole-genome case. Pitch comes from the whole axis, so a chromosome
  // narrower than that pitch catches one major and no more — a number that gives
  // a reader no spacing to measure with, and that sitting alone in a
  // chromosome's span reads as marking the span rather than a position in it.
  // homoeolog_synteny/oat_homoeologs shipped a nine-chromosome axis of them.
  const inRegion = (
    region: number,
    refName: string,
    type: 'major' | 'minor',
    alongPx: number,
  ) => ({
    tick: { type, base: alongPx, refName, displayedRegionIndex: region },
    alongPx,
  })

  test('a chromosome with one lone number loses it, and keeps its marks', () => {
    const out = thinTickPositions([
      inRegion(0, 'chr1', 'minor', 0),
      inRegion(0, 'chr1', 'major', 40),
      inRegion(0, 'chr1', 'minor', 80),
    ])
    expect(out.map(t => t.alongPx)).toEqual([0, 40, 80])
    expect(out.some(t => t.labeled)).toBe(false)
  })

  test('the quorum is per chromosome, not per axis', () => {
    const out = thinTickPositions([
      inRegion(0, 'chr1', 'major', 40),
      inRegion(1, 'chr2', 'major', 200),
      inRegion(1, 'chr2', 'major', 300),
      inRegion(1, 'chr2', 'major', 400),
    ])
    // chr1's single number goes; chr2 has a ruler and keeps all of its own
    expect(out.filter(t => t.labeled).map(t => t.alongPx)).toEqual([
      200, 300, 400,
    ])
  })

  // An axis can hold one refName twice — a read-vs-ref dotplot builds its h axis
  // from gatherOverlaps, so a read aligned twice to a chromosome yields two
  // regions on it. Keyed on refName alone these two would pool into a quorum of
  // 2 and both keep a lone number.
  test('two regions on one refName do not lend each other a quorum', () => {
    const out = thinTickPositions([
      inRegion(0, 'chr1', 'major', 40),
      inRegion(1, 'chr1', 'major', 400),
    ])
    expect(out.some(t => t.labeled)).toBe(false)
  })
})

describe('regionBoundaryLines', () => {
  const blocks = (...offsets: number[]) =>
    offsets.map((offsetPx, i) => ({
      ...staticBlock(0, 100),
      key: `b${i}`,
      offsetPx,
    }))

  test('one line per block, at the block position', () => {
    const out = regionBoundaryLines(
      blocks(0, 300, 700),
      b => b.offsetPx,
      -1,
      800,
    )
    expect(out).toEqual([
      { key: 'b0', px: 0 },
      { key: 'b1', px: 300 },
      { key: 'b2', px: 700 },
    ])
  })

  // whole-genome zoom on a fragmented assembly puts hundreds of scaffolds on
  // one column; stacked identical <line>s stroke visibly darker than a single
  // one, and the SVG export carries every copy
  test('blocks landing on one pixel draw one line', () => {
    const out = regionBoundaryLines(
      blocks(10, 10.4, 10.9, 12),
      b => b.offsetPx,
      -1,
      800,
    )
    expect(out.map(l => l.key)).toEqual(['b0', 'b3'])
  })

  test('the far end is drawn when it lands inside the plot', () => {
    expect(regionBoundaryLines([], () => 0, 500, 800).map(l => l.px)).toEqual([
      500,
    ])
  })

  test('an offscreen far end is not serialized at all', () => {
    expect(regionBoundaryLines([], () => 0, 9000, 800)).toEqual([])
    expect(regionBoundaryLines([], () => 0, -9000, 800)).toEqual([])
  })
})

describe('tickLines', () => {
  const at = (
    alongPx: number,
    type: 'major' | 'minor',
    labeled = type === 'major',
    region = 0,
  ) => ({
    tick: {
      type,
      base: alongPx,
      refName: `chr${region}`,
      displayedRegionIndex: region,
    },
    alongPx,
    labeled,
  })
  const same = (px: number) => px

  // the grid carries the ruler the axis already drew, both weights, rather than
  // being a second rule kept in step with it
  test('every visible tick earns a line, in its own weight', () => {
    const out = tickLines(
      [at(0, 'major'), at(15, 'minor'), at(30, 'minor'), at(60, 'major')],
      same,
      [],
    )
    expect(out).toEqual([
      { px: 0, major: true },
      { px: 15, major: false },
      { px: 30, major: false },
      { px: 60, major: true },
    ])
  })

  // The whole-genome case, and the reason this is gated on the numbers: pitch
  // comes from the whole axis, so every chromosome's band catches a couple of
  // lines from a pitch far coarser than its own span, ruling a few-pixel square
  // into pieces that measure nothing. Nothing numbered, nothing drawn.
  test('an axis with no numbers anywhere gets no grid', () => {
    const out = tickLines(
      [at(0, 'minor', false, 1), at(20, 'minor', false, 2)],
      same,
      [],
    )
    expect(out).toEqual([])
  })

  // a grid over one chromosome's band and not its neighbour's reads as
  // arbitrary, so the decision is the axis', not each region's — a sliver of the
  // previous chromosome at the viewport edge is gridded like the rest
  test('one numbered chromosome grids the whole axis, slivers included', () => {
    const out = tickLines(
      [
        at(0, 'minor', false, 1),
        at(200, 'major', true, 2),
        at(260, 'minor', false, 2),
      ],
      same,
      [],
    )
    expect(out.map(l => l.px)).toEqual([0, 200, 260])
  })

  // chooseGridPitch targets 15px minors inside a region, so this only bites
  // where two regions meet and their ticks pile onto one column
  test('a pile-up at a region seam is thinned', () => {
    const out = tickLines(
      [at(100, 'minor'), at(103, 'major'), at(106, 'minor'), at(130, 'minor')],
      same,
      [],
    )
    expect(out.map(l => l.px)).toEqual([100, 130])
  })

  // the boundary already draws a stronger line there; the two together read as
  // one heavier boundary and the gridline adds nothing
  test('a tick under a region boundary is left to the boundary', () => {
    const out = tickLines([at(100, 'major'), at(200, 'major')], same, [
      { key: 'b', px: 100.6 },
    ])
    expect(out.map(l => l.px)).toEqual([200])
  })

  // the vertical axis mirrors alongPx into screen y, so its kept ticks descend
  // and a signed spacing test would keep every one of them
  test('a mirrored axis is spaced in screen px', () => {
    const out = tickLines(
      [at(0, 'major'), at(5, 'minor'), at(60, 'major')],
      px => 500 - px,
      [],
    )
    expect(out.map(l => l.px)).toEqual([500, 440])
  })
})

describe('getBlockLabelKeysToHide', () => {
  test('well-separated labels are all kept', () => {
    const hide = getBlockLabelKeysToHide(
      [posBlock('a', 0, 200), posBlock('b', 400, 100)],
      600,
      0,
    )
    expect([...hide]).toEqual([])
  })

  test('a label overlapping a higher-priority (larger) one is hidden', () => {
    // a (len 200) at offsetPx 0 → pos 600, occupies [588,600)
    // b (len 100) at offsetPx 8 → pos 592, occupies [580,592), overlaps a
    const hide = getBlockLabelKeysToHide(
      [posBlock('a', 0, 200), posBlock('b', 8, 100)],
      600,
      0,
    )
    expect([...hide]).toEqual(['b'])
  })

  test('priority is by block length, independent of input order', () => {
    // smaller block listed first, but the larger one wins the slot
    const hide = getBlockLabelKeysToHide(
      [posBlock('small', 8, 100), posBlock('big', 0, 200)],
      600,
      0,
    )
    expect([...hide]).toEqual(['small'])
  })

  test('a label exactly at position 0 is hidden', () => {
    const hide = getBlockLabelKeysToHide([posBlock('a', 600, 100)], 600, 0)
    expect([...hide]).toEqual(['a'])
  })

  test('a label scrolled to a negative position is kept and blocks nothing', () => {
    // a is off-axis (pos -100) so it is kept and does not occupy any slot,
    // leaving b free to render
    const hide = getBlockLabelKeysToHide(
      [posBlock('a', 700, 200), posBlock('b', 0, 100)],
      600,
      0,
    )
    expect([...hide]).toEqual([])
  })

  test('viewOffsetPx shifts label positions', () => {
    // with viewOffsetPx=100, a at offsetPx 700 → pos 0 → hidden
    const hide = getBlockLabelKeysToHide([posBlock('a', 700, 100)], 600, 100)
    expect([...hide]).toEqual(['a'])
  })
})
