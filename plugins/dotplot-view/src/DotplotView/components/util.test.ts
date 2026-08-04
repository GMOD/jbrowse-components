import {
  axisBorderPx,
  getBlockLabelKeysToHide,
  makeTicks,
  tickKey,
  truncateRefName,
} from './util.ts'

import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

function region(refName: string, end: number, start = 0) {
  return { refName, start, end }
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

  test('long names are middle-elided, keeping prefix and suffix', () => {
    expect(truncateRefName('scaffold_1234')).toBe('scaf…1234')
  })
})

describe('axisBorderPx', () => {
  test('empty regions fall back to the minimum border', () => {
    expect(axisBorderPx([], 1)).toBe(50)
  })

  test('the widest region label drives the border', () => {
    const short = axisBorderPx([region('chr1', 1_000)], 1)
    const long = axisBorderPx(
      [region('chr1', 1_000), region('a_long_scaffold_name', 1_000)],
      1,
    )
    expect(long).toBeGreaterThan(short)
  })

  test('a truncated long name does not grow the border without bound', () => {
    // both names truncate to the same 9-char display, so the border matches
    expect(axisBorderPx([region('scaffold_1234', 1_000)], 1)).toBe(
      axisBorderPx([region('scaffold_9999', 1_000)], 1),
    )
  })

  test('a region too small to show a label does not inflate the border', () => {
    const bpPerPx = 1_000_000 // chr1 spans 20px; the contig spans 0.5px
    const withContig = axisBorderPx(
      [
        region('chr1', 20_000_000),
        region('chr1_random_unplaced', 20_500_000, 20_000_000),
      ],
      bpPerPx,
    )
    const chr1Only = axisBorderPx([region('chr1', 20_000_000)], bpPerPx)
    expect(withContig).toBe(chr1Only)
  })

  test('bpPerPx changes tick-label precision and so the border', () => {
    // "1,234,567" (bpPerPx=1) is a wider tick than "1.23M" (bpPerPx=1000);
    // both spans stay above LABEL_PX so the filter keeps them
    const fine = axisBorderPx([region('chr1', 1_234_567)], 1)
    const coarse = axisBorderPx([region('chr1', 1_234_567)], 1_000)
    expect(fine).toBeGreaterThan(coarse)
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
