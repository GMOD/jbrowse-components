import configFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import stateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'
import matrixConfigFactory from '../LinearMultiSampleVariantMatrixDisplay/configSchema.ts'
import matrixStateModelFactory from '../LinearMultiSampleVariantMatrixDisplay/model.ts'

// The raw `rowHeight` property holds px, or 0 for fit-to-display-height; the
// resolved value is the `effectiveRowHeight` getter (0 -> availableHeight/nrow).
// These lock in that contract and the proportional drag-resize.
function createDisplay() {
  const configSchema = configFactory()
  return stateModelFactory(configSchema).create({
    type: 'LinearMultiSampleVariantDisplay',
    configuration: configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'test',
    }),
  })
}

describe('row height resolution', () => {
  it('defaults to fit mode (rowHeight 0)', () => {
    const m = createDisplay()
    expect(m.rowHeight).toBe(0)
    expect(m.effectiveRowHeight).toBe(m.availableHeight / m.nrow)
  })

  it('a positive rowHeight pins effectiveRowHeight', () => {
    const m = createDisplay()
    m.setRowHeight(20)
    expect(m.effectiveRowHeight).toBe(20)
  })

  // Fit mode divides availableHeight across the rows, so the content fills the
  // viewport exactly: nothing overflows and there is nothing to scroll.
  it('fit mode fills the viewport exactly (no overflow, no scroll)', () => {
    const m = createDisplay()
    m.setSources([{ name: 'A' }, { name: 'B' }, { name: 'C' }])
    expect(m.nrow).toBe(3)
    expect(m.effectiveRowHeight).toBe(m.availableHeight / 3)
    expect(m.totalHeight).toBeCloseTo(m.availableHeight)
    expect(m.hasOverflow).toBe(false)
    expect(m.scrollableHeight).toBe(0)
  })

  // A pinned rowHeight taller than the fit height makes the rows overflow the
  // viewport; totalHeight tracks nrow and the excess becomes scrollable.
  it('a pinned rowHeight taller than fit overflows and scrolls', () => {
    const m = createDisplay()
    m.setSources([{ name: 'A' }, { name: 'B' }, { name: 'C' }])
    const rh = m.availableHeight // each row as tall as the whole viewport
    m.setRowHeight(rh)
    expect(m.totalHeight).toBe(rh * 3)
    expect(m.hasOverflow).toBe(true)
    expect(m.scrollableHeight).toBe(rh * 2)
  })

  it('setFitToHeight returns to fit mode', () => {
    const m = createDisplay()
    m.setRowHeight(20)
    m.setFitToHeight()
    expect(m.rowHeight).toBe(0)
    expect(m.effectiveRowHeight).toBe(m.availableHeight / m.nrow)
  })

  it('resizeHeight scales a pinned rowHeight proportionally', () => {
    const m = createDisplay()
    m.setRowHeight(10)
    const oldHeight = m.height
    m.resizeHeight(oldHeight) // double the display height
    expect(m.height).toBe(oldHeight * 2)
    expect(m.rowHeight).toBeCloseTo(20)
  })

  it('resizeHeight leaves fit mode (rowHeight 0) untouched', () => {
    const m = createDisplay()
    const oldHeight = m.height
    m.resizeHeight(oldHeight)
    expect(m.rowHeight).toBe(0)
    expect(m.height).toBe(oldHeight * 2)
  })

  // The matrix display reserves a `lineZoneHeight` (20px) for the connector
  // zone, so rows live in `availableHeight = height - lineZoneHeight`. A pinned
  // rowHeight must scale by the available-height ratio, not the full-height
  // ratio, or the visible fraction of rows drifts on resize.
  it('resizeHeight scales a pinned rowHeight by availableHeight (matrix)', () => {
    const configSchema = matrixConfigFactory()
    const m = matrixStateModelFactory(configSchema).create({
      type: 'LinearMultiSampleVariantMatrixDisplay',
      configuration: configSchema.create({
        type: 'LinearMultiSampleVariantMatrixDisplay',
        displayId: 'test-matrix',
      }),
    })
    m.setRowHeight(10)
    const oldHeight = m.height
    // grow the display so availableHeight exactly doubles
    m.resizeHeight(oldHeight - m.lineZoneHeight)
    expect(m.height).toBe(2 * oldHeight - m.lineZoneHeight)
    expect(m.rowHeight).toBeCloseTo(20)
  })
})
