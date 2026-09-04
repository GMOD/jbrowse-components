import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

import { bpCull, bpSpanPx, rowBandGeometry } from './visibleRegionGeometry.ts'

// Half-open at both ends, in one spelling. Ten walks used to carry this test
// between them in two De Morgan forms, which is how a cull drifts.
describe('bpCull', () => {
  const { overlaps } = bpCull(100, 200)

  it.each([
    [120, 130, true],
    [90, 100, false],
    [90, 101, true],
    [200, 210, false],
    [199, 210, true],
  ])('overlaps(%i, %i) is %s', (startBp, endBp, expected) => {
    expect(overlaps(startBp, endBp)).toBe(expected)
  })
})

// `bpToPx` counts down on a reversed region, so an interval's start is its
// *right* edge and a min-width widening has to grow leftward from it
// (`spanLeft`). Widening off the leftmost edge anchors the interval's end and
// slides the mark by up to `minWidth` — invisible on every forward region, and
// the summary bars, CDS strips, source-chromosome fills and codon conservation
// bars each spelled it that way.
describe('bpSpanPx', () => {
  const forward = (bp: number) => (bp - 100) / 10
  const reversed = (bp: number) => (200 - bp) / 10

  it('spans an interval left to right whichever way the region runs', () => {
    expect(bpSpanPx(forward, 100, 200)).toEqual({ xLeft: 0, width: 10 })
    expect(bpSpanPx(reversed, 100, 200)).toEqual({ xLeft: 0, width: 10 })
  })

  it('widens a sub-pixel interval away from its start edge', () => {
    expect(bpSpanPx(forward, 100, 101, 1)).toEqual({ xLeft: 0, width: 1 })
    expect(bpSpanPx(reversed, 100, 101, 1)).toEqual({ xLeft: 9, width: 1 })
  })
})

// The GPU pass places every row band through rowRect.slang's rowBandPx, whose
// scalar twins are generated. The Canvas2D painter, the overlays and the SVG
// export place theirs through rowBandGeometry, so the two must agree on every
// height — including sub-pixel rows, where the shader floors the drawn band at
// MIN_DRAWN_ROW_PX so rows overlap instead of dropping out.
describe('rowBandGeometry matches the generated rowRect twins', () => {
  const heights = [0.1, 0.25, 0.5, 0.9, 1, 1.5, 2, 7, 12, 40]
  const proportions = [0.3, 0.8, 1]
  const scrollTops = [0, 3.5, 120]

  it.each(
    heights.flatMap(rowHeight =>
      proportions.flatMap(rowProportion =>
        scrollTops.map(scrollTop => ({ rowHeight, rowProportion, scrollTop })),
      ),
    ),
  )(
    'rowHeight=$rowHeight proportion=$rowProportion scrollTop=$scrollTop',
    ({ rowHeight, rowProportion, scrollTop }) => {
      const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
      expect(h).toBe(drawnRowHeightPx(rowHeight, rowProportion))
      expect(offset).toBe(rowBandOffsetPx(rowHeight, rowProportion) - scrollTop)
    },
  )

  it('floors a sub-pixel band at 1px, centered so it overhangs evenly', () => {
    const { h, offset } = rowBandGeometry(0.4, 1, 0)
    expect(h).toBe(1)
    expect(offset).toBeCloseTo(-0.3)
  })

  it('leaves a normal band at its natural height and inset', () => {
    const { h, offset } = rowBandGeometry(10, 0.8, 0)
    expect(h).toBe(8)
    expect(offset).toBe(1)
  })
})
