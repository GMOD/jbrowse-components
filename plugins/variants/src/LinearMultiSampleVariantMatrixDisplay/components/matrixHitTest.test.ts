import { matrixCellAt } from './matrixHitTest.ts'

// 1000 Genomes: 2,504 samples over the 230px left under the line zone at the
// default height of 250. This is the fit the two sibling fixes were measured
// against, and the display the commit message named while editing the other one.
const KILOGENOMES = {
  columnWidth: 8,
  effectiveRowHeight: 230 / 2504,
  scrollTop: 0,
}

describe('matrixCellAt', () => {
  it('reads the column off the pitch', () => {
    expect(matrixCellAt(KILOGENOMES, 0, 0).featureIdx).toBe(0)
    expect(matrixCellAt(KILOGENOMES, 7.9, 0).featureIdx).toBe(0)
    expect(matrixCellAt(KILOGENOMES, 8, 0).featureIdx).toBe(1)
  })

  it('asks at the pixel centre, 5 rows off the top-edge answer', () => {
    expect(matrixCellAt(KILOGENOMES, 0, 100).nearest).toBe(1094)
    // what the component computed before: floor((mouseY + scrollTop)/rowHeight)
    expect(Math.floor(100 / KILOGENOMES.effectiveRowHeight)).toBe(1088)
  })

  // applyRowResizeWheel leaves scrollTop fractional; the matrix composes it
  // through useVariantVirtualScroll like the sibling does. The two orderings
  // only disagree once the fractional part carries across a row boundary, so
  // an ordinary 10px row cannot discriminate them.
  it('floors mouseY before adding a fractional scrollTop', () => {
    const geom = { ...KILOGENOMES, effectiveRowHeight: 1, scrollTop: 0.7 }
    expect(matrixCellAt(geom, 0, 25).nearest).toBe(26)
    // flooring the sum instead lands a row earlier
    expect(Math.floor(Math.floor(25 + 0.7) + 0.5)).toBe(25)
  })

  it('walks the rows sharing one drawn pixel', () => {
    // the shader floors the cell at 1px, so at 0.09px a row eleven rows land
    // under the pixel and only the nearest is on top
    const { nearest, lowest } = matrixCellAt(KILOGENOMES, 0, 100)
    expect(nearest - lowest).toBe(10)
    expect(lowest).toBe(1084)
  })

  it('collapses to one row once rows clear the 1px floor', () => {
    const geom = { ...KILOGENOMES, effectiveRowHeight: 4 }
    const { nearest, lowest } = matrixCellAt(geom, 0, 25)
    expect(nearest).toBe(6)
    expect(lowest).toBe(6)
  })

  it('does not walk below row 0', () => {
    expect(matrixCellAt(KILOGENOMES, 0, 0).lowest).toBe(0)
  })
})
