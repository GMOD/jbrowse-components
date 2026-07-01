import configFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import stateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'

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
})
