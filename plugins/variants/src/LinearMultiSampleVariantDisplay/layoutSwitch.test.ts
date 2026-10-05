import { createTestEnvironment } from './testEnv.ts'

test('the layout is a fetch input, and columns spend no band on the lane', () => {
  const { display } = createTestEnvironment({
    displayConfig: { showVariantLane: true },
  }).createDisplay()
  expect(display.rpcProps().layout).toBe('genomic')
  expect(display.showVariantLane).toBe(true)
  expect(display.lineZoneHeight).toBe(0)

  display.setVariantLayout('columns')

  expect(display.rpcProps().layout).toBe('columns')
  // columns draw reference cells whatever the setting says
  expect(display.rpcProps()).toHaveProperty('referenceDrawingMode', 'draw')
  expect(display.showVariantLane).toBe(false)
  expect(display.topBands.laneHeight).toBe(0)
  expect(display.lineZoneHeight).toBe(20)
  expect(display.rowsTopOffset).toBe(20)
  expect(display.drawsInsertionMarkers).toBe(false)
})

test('Show as genotype matrix switches the layout both ways', () => {
  const { display } = createTestEnvironment().createDisplay()
  const matrixItem = () => {
    const item = display
      .showSubmenuItems()
      .find(i => 'label' in i && i.label === 'Show as genotype matrix')
    if (!item || !('checked' in item) || !('onClick' in item)) {
      throw new Error('no "Show as genotype matrix" checkbox')
    }
    return item
  }

  expect(matrixItem().checked).toBe(false)
  matrixItem().onClick()
  expect(display.variantLayout).toBe('columns')
  expect(matrixItem().checked).toBe(true)
  matrixItem().onClick()
  expect(display.variantLayout).toBe('genomic')
})
