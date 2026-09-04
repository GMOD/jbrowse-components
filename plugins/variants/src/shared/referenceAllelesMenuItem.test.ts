import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { createTestEnvironment as createMatrixTestEnvironment } from '../LinearMultiSampleVariantMatrixDisplay/testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The regular display lays variants out at their genomic positions, so `skip`
// drops the reference cells in the worker and the whole row reads as one solid
// grey band that overlapping SVs stand out against. The matrix packs every
// column with a variant and paints reference cells in REFERENCE_COLOR, which is
// the same grey `skip` fills its background with — so the toggle moves no pixel
// there, and the row it used to carry described a setting it did not have.
function referenceItem(items: MenuItem[]) {
  const show = items.find(i => 'label' in i && i.label === 'Show...')
  const subMenu = show && 'subMenu' in show ? resolveSubMenu(show) : []
  return subMenu.find(i => 'label' in i && i.label === 'Show reference alleles')
}

test('the regular display offers the reference-alleles checkbox', () => {
  const { display } = createTestEnvironment().createDisplay()
  const item = referenceItem(display.trackMenuItems())
  if (!item || !('type' in item) || item.type !== 'checkbox') {
    throw new Error('no "Show reference alleles" checkbox in "Show..."')
  }
  // 'skip' is the slot default, so it starts unchecked
  expect(item.checked).toBe(false)
  expect(staysOpenOnClick(item)).toBe(true)

  item.onClick()
  expect(display.referenceDrawingMode).toBe('draw')
  const after = referenceItem(display.trackMenuItems())
  expect(after && 'checked' in after && after.checked).toBe(true)
})

// `referenceDrawingMode` still travels between the two in PORTABLE_CONFIG_KEYS,
// so a mode set here and carried to the matrix is inert there and comes back
// intact — nothing gets stuck without the row.
test('the matrix display does not', () => {
  const { display } = createMatrixTestEnvironment().createDisplay()
  expect(display.showsReferenceToggle).toBe(false)
  expect(referenceItem(display.trackMenuItems())).toBeUndefined()
})
