import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import stateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'
import matrixConfigFactory from '../LinearMultiSampleVariantMatrixDisplay/configSchema.ts'
import matrixStateModelFactory from '../LinearMultiSampleVariantMatrixDisplay/model.ts'

// The raw `rowHeight` setting holds px, or 0 for fit-to-display-height; the
// resolved value is the `effectiveRowHeight` getter (0 -> availableHeight/nrow).
// These lock in that contract and the drag-resize behavior.
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
    expect(m.scrollableHeight).toBe(rh * 2)
  })

  // With more samples than pixels (e.g. a 3202-sample cohort in a 200px
  // display), the auto-fit height is legitimately sub-1px. effectiveRowHeight
  // must return that fractional value, not floor it to 1 -- flooring here
  // would make totalHeight balloon past availableHeight and falsely report a
  // scroll in a mode that's documented to never have one.
  it('fit mode keeps a sub-1px row height when samples outnumber pixels', () => {
    const m = createDisplay()
    m.setSources(
      Array.from({ length: 3202 }, (_, i) => ({ name: `sample${i}` })),
    )
    const expected = m.availableHeight / 3202
    expect(expected).toBeLessThan(1)
    expect(m.effectiveRowHeight).toBe(expected)
    expect(m.scrollableHeight).toBe(0)
  })

  // lineZoneHeight (matrix only) is user-draggable independently of height --
  // e.g. dragging the connector-line zone taller, then shrinking the display
  // -- so it can swallow the whole display. availableHeight floors at 0
  // rather than going negative (every consumer treats it as a real pixel
  // dimension: canvas height, CSS height, scroll viewport height), and
  // effectiveRowHeight floors the resulting 0-height row to 1 rather than
  // propagating a NaN/Infinity divide-by-zero downstream.
  it('floors availableHeight/effectiveRowHeight when lineZoneHeight swallows the display', () => {
    const configSchema = matrixConfigFactory()
    const m = matrixStateModelFactory(configSchema).create({
      type: 'LinearMultiSampleVariantMatrixDisplay',
      configuration: configSchema.create({
        type: 'LinearMultiSampleVariantMatrixDisplay',
        displayId: 'test-matrix-degenerate',
      }),
    })
    m.setHeight(20)
    m.setLineZoneHeight(1000)
    expect(m.availableHeight).toBe(0)
    expect(m.effectiveRowHeight).toBe(1)
  })

  it('setFitToHeight returns to fit mode', () => {
    const m = createDisplay()
    m.setRowHeight(20)
    m.setFitToHeight()
    expect(m.rowHeight).toBe(0)
    expect(m.effectiveRowHeight).toBe(m.availableHeight / m.nrow)
  })

  // A pinned row height is the size the user asked for, so a drag changes how
  // many rows fit, not how big they are. Scaling the pin by the same ratio
  // would keep content and viewport locked together, making a taller track
  // unable to reveal one extra sample.
  it('resizeHeight leaves a pinned rowHeight alone and reveals more rows', () => {
    const m = createDisplay()
    m.setSources([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }])
    m.setRowHeight(10)
    const oldHeight = m.height
    const oldVisible = m.availableHeight / m.effectiveRowHeight
    m.resizeHeight(oldHeight) // double the display height
    expect(m.height).toBe(oldHeight * 2)
    expect(m.rowHeight).toBe(10)
    expect(m.effectiveRowHeight).toBe(10)
    expect(m.availableHeight / m.effectiveRowHeight).toBeGreaterThan(oldVisible)
  })

  it('resizeHeight restretches the rows in fit mode', () => {
    const m = createDisplay()
    const oldHeight = m.height
    m.resizeHeight(oldHeight)
    expect(m.rowHeight).toBe(0)
    expect(m.height).toBe(oldHeight * 2)
    expect(m.effectiveRowHeight).toBe(m.availableHeight / m.nrow)
  })

  // The matrix display reserves a `lineZoneHeight` (20px) for the connector
  // zone, so rows live in `availableHeight = height - lineZoneHeight`. A pinned
  // height is unaffected by either; only the row count that fits changes.
  it('resizeHeight leaves a pinned rowHeight alone (matrix)', () => {
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
    m.resizeHeight(oldHeight - m.lineZoneHeight)
    expect(m.height).toBe(2 * oldHeight - m.lineZoneHeight)
    expect(m.rowHeight).toBe(10)
  })

  // Shrinking the matrix to its 20px floor leaves no room for rows at all (the
  // default 20px connector zone takes the lot). The pinned height has to
  // survive the trip down -- landing it on 0 would silently flip the display
  // into fit mode -- and come back unchanged.
  it('resizeHeight keeps a pinned rowHeight through a zero-room shrink (matrix)', () => {
    const configSchema = matrixConfigFactory()
    const m = matrixStateModelFactory(configSchema).create({
      type: 'LinearMultiSampleVariantMatrixDisplay',
      configuration: configSchema.create({
        type: 'LinearMultiSampleVariantMatrixDisplay',
        displayId: 'test-matrix-shrink',
      }),
    })
    m.setRowHeight(10)
    const oldHeight = m.height
    m.resizeHeight(-oldHeight) // clamps to the 20px floor == lineZoneHeight
    expect(m.height).toBe(20)
    expect(m.availableHeight).toBe(0)
    expect(m.rowHeight).toBe(10)
    m.resizeHeight(oldHeight - 20)
    expect(m.rowHeight).toBe(10)
  })

  // rowHeight lives on the config node, which outlives the display instance, so
  // a pinned height survives unticking and reticking the track.
  it('pins the row height on the config slot, not the display snapshot', () => {
    const m = createDisplay()
    m.setRowHeight(25)
    expect(readConfObject(m.configuration, 'rowHeight')).toBe(25)
    expect('rowHeight' in getSnapshot(m)).toBe(false)
  })
})
