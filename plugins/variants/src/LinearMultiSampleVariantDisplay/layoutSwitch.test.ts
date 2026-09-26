import { createTestEnvironment } from './testEnv.ts'

test('the layout is a fetch input, and columns spend no band on the lane', () => {
  const { display } = createTestEnvironment({
    displayConfig: { showVariantLane: true },
  }).createDisplay()
  expect(display.rpcProps().mode).toBe('regular')
  expect(display.showVariantLane).toBe(true)
  expect(display.lineZoneHeight).toBe(0)

  display.setVariantLayout('columns')

  expect(display.rpcProps().mode).toBe('matrix')
  // the worker ships reference cells in columns whatever the setting says
  expect(display.rpcProps()).toHaveProperty('referenceDrawingMode', undefined)
  expect(display.showVariantLane).toBe(false)
  expect(display.topBands.laneHeight).toBe(0)
  expect(display.lineZoneHeight).toBe(20)
  expect(display.rowsTopOffset).toBe(20)
  expect(display.drawsInsertionMarkers).toBe(false)
})

test('the track menu offers both layouts under one radio', () => {
  const { display } = createTestEnvironment().createDisplay()
  const layout = display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Variant layout')
  const labels =
    layout && 'subMenu' in layout && Array.isArray(layout.subMenu)
      ? layout.subMenu.map(item => ('label' in item ? item.label : ''))
      : []
  expect(labels).toEqual(['At genomic positions', 'Equal-width columns'])
})
