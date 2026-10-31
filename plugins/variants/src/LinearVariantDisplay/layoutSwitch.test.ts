import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { SIDEBAR_HINT_LINE_PX } from '@jbrowse/tree-sidebar'

import { createTestEnvironment } from './testEnv.ts'
import { variantTrackMenuItems } from './variantDisplayMenuItems.ts'
import { BAND_CHIPS_HEIGHT } from './variantTopBands.ts'

test('the layout is a fetch input, and only columns reserve a connector zone', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.rpcProps().layout).toBe('genomic')
  expect(display.lineZoneHeight).toBe(0)
  expect(display.rowsTopOffset).toBe(BAND_CHIPS_HEIGHT)

  display.setVariantLayout('columns')

  expect(display.rpcProps().layout).toBe('columns')
  // columns draw reference cells whatever the setting says
  expect(display.rpcProps()).toHaveProperty('showReference', true)
  expect(display.lineZoneHeight).toBe(20)
  expect(display.rowsTopOffset).toBe(20)
})

test('Layout → Genotype matrix switches the layout both ways', () => {
  const { display } = createTestEnvironment().createDisplay()
  const matrixItem = () => {
    const layout = variantTrackMenuItems(display).find(
      i => 'label' in i && i.label === 'Layout',
    )
    const item =
      layout && 'subMenu' in layout
        ? resolveSubMenu(layout).find(
            i => 'label' in i && i.label === 'Genotype matrix',
          )
        : undefined
    if (!item || !('checked' in item) || !('onClick' in item)) {
      throw new Error('no "Genotype matrix" checkbox')
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

test('a kept subset puts the focus chip in a line above the rows', () => {
  const { display } = createTestEnvironment().createDisplay()
  const height = display.availableHeight

  display.setRowFocus(['a'])

  expect(display.rowsTopOffset).toBe(BAND_CHIPS_HEIGHT + SIDEBAR_HINT_LINE_PX)
  expect(display.availableHeight).toBe(height - SIDEBAR_HINT_LINE_PX)
})
