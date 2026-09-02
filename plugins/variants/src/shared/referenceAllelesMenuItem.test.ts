import { staysOpenOnClick } from '@jbrowse/core/ui'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { createTestEnvironment as createMatrixTestEnvironment } from '../LinearMultiSampleVariantMatrixDisplay/testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// `referenceDrawingMode` decides the fill on both displays — the regular one
// drops the reference cells in the worker, the matrix greys its background
// behind them — and it travels between them in PORTABLE_CONFIG_KEYS. The
// checkbox over it was only on the regular display's menu, so a matrix track
// could inherit a mode it had no way to change back.
function referenceItem(items: MenuItem[]) {
  const show = items.find(i => 'label' in i && i.label === 'Show...')
  const subMenu = show && 'subMenu' in show ? show.subMenu : []
  const item = subMenu.find(
    i => 'label' in i && i.label === 'Show reference alleles',
  )
  if (!item || !('type' in item) || item.type !== 'checkbox') {
    throw new Error('no "Show reference alleles" checkbox in "Show..."')
  }
  return item
}

test('both displays offer the reference-alleles checkbox', () => {
  const { display: regular } = createTestEnvironment().createDisplay()
  const { display: matrix } = createMatrixTestEnvironment().createDisplay()
  for (const display of [regular, matrix]) {
    const item = referenceItem(display.trackMenuItems())
    // 'skip' is the slot default, so it starts unchecked
    expect(item.checked).toBe(false)
    expect(staysOpenOnClick(item)).toBe(true)

    item.onClick()
    expect(display.referenceDrawingMode).toBe('draw')
    expect(referenceItem(display.trackMenuItems()).checked).toBe(true)
  }
})
