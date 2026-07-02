import {
  bpToPx,
  computeMoveToLayout,
  getLayoutHighlightCoords,
  moveTo,
  pxToBp,
} from './Base1DUtils.ts'
import calculateDynamicBlocks from './calculateDynamicBlocks.ts'
import calculateBlocks from './calculateStaticBlocks.ts'

function makeSnap(
  regions: {
    refName: string
    start: number
    end: number
    reversed?: boolean
  }[],
  opts: { bpPerPx?: number; offsetPx?: number } = {},
) {
  const bpPerPx = opts.bpPerPx ?? 1
  const offsetPx = opts.offsetPx ?? 0
  return {
    bpPerPx,
    offsetPx,
    displayedRegions: regions.map(r => ({ assemblyName: 'test', ...r })),
    minimumBlockWidth: 3,
    width: 800,
  }
}

describe('bpToPx', () => {
  it('returns correct offsetPx for single region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = bpToPx({ self, refName: 'chr1', coord: 500 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(500)
  })

  it('places adjacent regions consecutively', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(2000)
  })

  it('elided regions have no gap', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(1001)
  })

  it('gives consistent results regardless of scroll position', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ]

    const atStart = makeSnap(regions, { offsetPx: 0 })
    const scrolled = makeSnap(regions, { offsetPx: 2000 })

    const r1 = bpToPx({ self: atStart, refName: 'chr3', coord: 500 })
    const r2 = bpToPx({ self: scrolled, refName: 'chr3', coord: 500 })
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1!.offsetPx).toBe(r2!.offsetPx)
  })

  it('matches calculateStaticBlocks block positions', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
      { refName: 'chr4', start: 0, end: 1000 },
      { refName: 'chr5', start: 0, end: 1000 },
    ]

    const self = makeSnap(regions, { offsetPx: 4000 })
    const result = bpToPx({ self, refName: 'chr5', coord: 0 })
    expect(result).toBeDefined()

    const staticBlocks = calculateBlocks(self)
    const chr5Blocks = staticBlocks.contentBlocks.filter(
      b => b.refName === 'chr5',
    )
    expect(chr5Blocks.length).toBeGreaterThan(0)
    expect(result!.offsetPx).toBe(chr5Blocks[0]!.offsetPx)
  })
})

describe('pxToBp', () => {
  it('returns correct coordinate for single region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = pxToBp(self, 500)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('chr1')
    expect(result.offset).toBe(500)
  })

  it('places third region at combined length of first two', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = pxToBp(self, 2000)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('chr3')
    expect(result.offset).toBe(0)
  })

  it('pixel at region boundary maps to next region start', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])
    const result = pxToBp(self, 1000)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('chr2')
    expect(result.offset).toBe(0)
  })

  it('elided region contributes its bp width with no gap', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const atChr3Start = pxToBp(self, 1001)
    expect(atChr3Start.oob).toBe(false)
    expect(atChr3Start.refName).toBe('chr3')
    expect(atChr3Start.offset).toBe(0)
  })

  it('is inverse of bpToPx', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ]
    const self = makeSnap(regions)

    const bp2px = bpToPx({ self, refName: 'chr3', coord: 500 })
    expect(bp2px).toBeDefined()

    const px2bp = pxToBp(self, bp2px!.offsetPx)
    expect(px2bp.refName).toBe('chr3')
    expect(px2bp.offset).toBe(500)
  })

  it('coord0 is the 0-based sibling of coord and round-trips through bpToPx', () => {
    const self = makeSnap([{ refName: 'chr1', start: 1000, end: 2000 }])
    const result = pxToBp(self, 500)
    expect(result.coord0).toBe(result.coord - 1)
    // coord0 is the BED-style base bpToPx consumes; feeding it back lands on the
    // same pixel, whereas the 1-based coord would be off by one bp
    const back = bpToPx({ self, refName: 'chr1', coord: result.coord0 })
    expect(back!.offsetPx).toBe(500)
  })

  it('coord0 tracks coord on reversed regions', () => {
    const self = makeSnap([{ refName: 'ctgA', start: 0, end: 1000, reversed: true }])
    const result = pxToBp(self, 300)
    expect(result.coord0).toBe(result.coord - 1)
  })

  it('handles oob before first region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = pxToBp(self, -100)
    expect(result.oob).toBe(true)
    expect(result.refName).toBe('chr1')
  })

  it('handles oob after last region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = pxToBp(self, 1500)
    expect(result.oob).toBe(true)
    expect(result.refName).toBe('chr1')
  })
})

describe('reversed region handling', () => {
  it('bpToPx places coord at correct pixel for reversed region', () => {
    const self = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    // reversed: bpSoFar = r.end - coord = 1000 - 500 = 500 → offsetPx = 500
    const result = bpToPx({ self, refName: 'ctgA', coord: 500 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(500)
  })

  it('pxToBp returns correct offset for reversed region', () => {
    const self = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    const result = pxToBp(self, 300)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('ctgA')
    expect(result.reversed).toBe(true)
    expect(result.offset).toBe(300)
  })

  it('bpToPx and pxToBp round-trip for reversed region', () => {
    const self = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    const bp2px = bpToPx({ self, refName: 'ctgA', coord: 300 })
    expect(bp2px).toBeDefined()
    const px2bp = pxToBp(self, bp2px!.offsetPx)
    expect(px2bp.refName).toBe('ctgA')
    // offset = r.end - coord = 1000 - 300 = 700
    expect(px2bp.offset).toBe(700)
  })

  it('bpToPx gives symmetric results for reversed vs forward at same bp distance', () => {
    const forward = makeSnap([{ refName: 'ctgA', start: 0, end: 1000 }])
    const reversed = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    // coord 200 is 200bp from start in forward, 800bp from start (200bp from end) in reversed
    const fwdPx = bpToPx({ self: forward, refName: 'ctgA', coord: 200 })
    const revPx = bpToPx({ self: reversed, refName: 'ctgA', coord: 800 })
    expect(fwdPx!.offsetPx).toBe(revPx!.offsetPx)
  })
})

describe('elided region handling', () => {
  it('bpToPx skips padding after elided region', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const r1 = bpToPx({ self, refName: 'chr1', coord: 1000 })
    const r2 = bpToPx({ self, refName: 'chr2', coord: 0 })
    const r3 = bpToPx({ self, refName: 'chr3', coord: 0 })

    expect(r1!.offsetPx).toBe(1000)
    expect(r2!.offsetPx).toBe(1000)
    expect(r3!.offsetPx).toBe(1001)
  })

  it('pxToBp skips padding after elided region', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const atChr2 = pxToBp(self, 1000)
    expect(atChr2.refName).toBe('chr2')
    expect(atChr2.offset).toBeCloseTo(0, 5)

    const atChr3 = pxToBp(self, 1001)
    expect(atChr3.refName).toBe('chr3')
    expect(atChr3.offset).toBeCloseTo(0, 5)
  })

  it('bpToPx and pxToBp round-trip through elided regions', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 2 },
      { refName: 'chr4', start: 0, end: 1 },
      { refName: 'chr5', start: 0, end: 1000 },
    ])

    const bp2px = bpToPx({ self, refName: 'chr5', coord: 500 })
    expect(bp2px).toBeDefined()

    const px2bp = pxToBp(self, bp2px!.offsetPx)
    expect(px2bp.refName).toBe('chr5')
    expect(px2bp.offset).toBe(500)
  })

  it('consecutive elided regions accumulate width without padding', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 2 },
      { refName: 'chr4', start: 0, end: 1 },
      { refName: 'chr5', start: 0, end: 1000 },
    ])

    const r5 = bpToPx({ self, refName: 'chr5', coord: 0 })
    expect(r5!.offsetPx).toBe(1004)
  })

  it('elided region at start does not get padding', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])

    const r2 = bpToPx({ self, refName: 'chr2', coord: 0 })
    expect(r2!.offsetPx).toBe(1)

    const px2bp = pxToBp(self, 1)
    expect(px2bp.refName).toBe('chr2')
    expect(px2bp.offset).toBeCloseTo(0, 5)
  })

  it('all regions elided returns correct bpToPx', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1 },
      { refName: 'chr2', start: 0, end: 2 },
      { refName: 'chr3', start: 0, end: 1 },
    ])

    const r1 = bpToPx({ self, refName: 'chr1', coord: 0 })
    const r2 = bpToPx({ self, refName: 'chr2', coord: 0 })
    const r3 = bpToPx({ self, refName: 'chr3', coord: 0 })

    expect(r1!.offsetPx).toBe(0)
    expect(r2!.offsetPx).toBe(1)
    expect(r3!.offsetPx).toBe(3)
  })
})

describe('computeMoveToLayout', () => {
  const region = (refName: string, len: number) => ({
    assemblyName: 'test',
    refName,
    start: 0,
    end: len,
  })

  function makeLayout(regions: ReturnType<typeof region>[]) {
    return {
      displayedRegions: regions,
      bpPerPx: 1,
      width: 800,
      minimumBlockWidth: 20,
      offsetPx: 0,
    }
  }

  it('zooms to fit a sub-region of a single chromosome', () => {
    const snap = makeLayout([region('chr1', 10_000)])
    // select bp 1000–3000 (2000bp) on a 800px view
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 0, offset: 1000 },
      { index: 0, offset: 3000 },
    )
    expect(bpPerPx).toBeCloseTo(2000 / 800)
    // 1000bp in at newBpPerPx
    expect(offsetPx).toBe(Math.round(1000 / bpPerPx))
  })

  it('produces content blocks covering the selected region', () => {
    const snap = makeLayout([region('chr1', 10_000)])
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 0, offset: 500 },
      { index: 0, offset: 2500 },
    )
    const blocks = calculateDynamicBlocks({ ...snap, bpPerPx, offsetPx })
    const content = blocks.contentBlocks
    expect(content.length).toBe(1)
    expect(content[0]!.start).toBeCloseTo(500, 0)
    expect(content[0]!.end).toBeCloseTo(2500, 0)
  })

  it('spans multiple chromosomes', () => {
    const snap = makeLayout([region('chr1', 1000), region('chr2', 1000)])
    // select all of chr1 (index 0, offset 0) to all of chr2 (index 1, offset 1000)
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 0, offset: 0 },
      { index: 1, offset: 1000 },
    )
    // 2000bp total across 800px
    expect(bpPerPx).toBeCloseTo(2000 / 800)
    const blocks = calculateDynamicBlocks({ ...snap, bpPerPx, offsetPx })
    const content = blocks.contentBlocks
    expect(content.length).toBe(2)
    expect(content[0]!.refName).toBe('chr1')
    expect(content[1]!.refName).toBe('chr2')
  })

  it('start at chr2 leaves chr1 out of content blocks', () => {
    const snap = makeLayout([region('chr1', 1000), region('chr2', 1000)])
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 1, offset: 0 },
      { index: 1, offset: 500 },
    )
    const blocks = calculateDynamicBlocks({ ...snap, bpPerPx, offsetPx })
    const refs = blocks.contentBlocks.map(b => b.refName)
    expect(refs).not.toContain('chr1')
    expect(refs).toContain('chr2')
  })
})

describe('getLayoutHighlightCoords', () => {
  it('returns pixel position+width for a forward region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const coords = getLayoutHighlightCoords(self, {
      refName: 'chr1',
      start: 100,
      end: 300,
    })
    expect(coords).toEqual({ left: 100, width: 200 })
  })

  it('returns identical coords regardless of start/end order', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const a = getLayoutHighlightCoords(self, {
      refName: 'chr1',
      start: 100,
      end: 300,
    })
    // swapped start/end — a reversed-bookmark in a forward displayed region
    // should still place the band at left=100 with width=200
    const b = getLayoutHighlightCoords(self, {
      refName: 'chr1',
      start: 300,
      end: 100,
    })
    expect(a).toEqual(b)
  })

  it('places the band correctly for a reversed displayed region', () => {
    // In a reversed region, bpToPx(start=0) is the right edge (offsetPx 1000)
    // and bpToPx(end=1000) is the left edge (offsetPx 0). Width should be the
    // |delta| (200), left should be min (200).
    const self = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    const coords = getLayoutHighlightCoords(self, {
      refName: 'ctgA',
      start: 700,
      end: 900,
    })
    expect(coords).toEqual({ left: 100, width: 200 })
  })

  it('subtracts layout.offsetPx so `left` is in viewport space', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }], {
      offsetPx: 50,
    })
    const coords = getLayoutHighlightCoords(self, {
      refName: 'chr1',
      start: 100,
      end: 300,
    })
    expect(coords).toEqual({ left: 50, width: 200 })
  })

  it('applies a 3px minimum width by default', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }], {
      bpPerPx: 100,
    })
    // 10bp at 100bp/px = 0.1px raw → floored to 3
    const coords = getLayoutHighlightCoords(self, {
      refName: 'chr1',
      start: 100,
      end: 110,
    })
    expect(coords?.width).toBe(3)
  })

  it('respects a custom minWidth (e.g. 0 for unclamped overview)', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }], {
      bpPerPx: 10,
    })
    const coords = getLayoutHighlightCoords(
      self,
      { refName: 'chr1', start: 100, end: 110 },
      0,
    )
    expect(coords?.width).toBe(1)
  })

  it('returns undefined when refName is not in displayed regions', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const coords = getLayoutHighlightCoords(self, {
      refName: 'chrZ',
      start: 100,
      end: 300,
    })
    expect(coords).toBeUndefined()
  })
})

describe('moveTo with clamped bpPerPx (extraBp path)', () => {
  // Simulate a view where zoomTo clamps bpPerPx to a max value, forcing moveTo
  // to center the selection with extraBp rather than fitting it precisely.
  it('centers the selection when zoomTo cannot zoom in far enough', () => {
    const displayedRegions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 10_000 },
    ]
    const minBpPerPx = 5 // floor: can't zoom in past 5bp/px

    let currentBpPerPx = 1
    let currentOffsetPx = 0

    const fakeView = {
      displayedRegions,
      bpPerPx: currentBpPerPx,
      width: 800,
      minimumBlockWidth: 20,
      zoomTo(bp: number) {
        currentBpPerPx = Math.max(bp, minBpPerPx)
        return currentBpPerPx
      },
      scrollTo(px: number) {
        currentOffsetPx = px
      },
    }

    // Select a 100bp window; unclamped that needs 100/800 = 0.125 bp/px,
    // but floor is 5bp/px so extraBp kicks in to center it.
    moveTo(fakeView, { index: 0, offset: 4000 }, { index: 0, offset: 4100 })

    expect(currentBpPerPx).toBe(minBpPerPx)
    // At 5bp/px the view covers 800*5=4000bp. The 100bp selection should be
    // centered, so scrollPos ≈ start - (4000-100)/2 / 5
    const viewBp = 800 * minBpPerPx
    const expectedCenter = 4050 // midpoint of 4000..4100
    const expectedOffsetPx = Math.round(
      (expectedCenter - viewBp / 2) / minBpPerPx,
    )
    expect(currentOffsetPx).toBe(expectedOffsetPx)
  })
})
