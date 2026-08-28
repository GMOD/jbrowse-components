import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

import { rowBandGeometry } from './visibleRegionGeometry.ts'

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
