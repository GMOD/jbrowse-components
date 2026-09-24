import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

// Phased rows are haplotypes, so there is no dosage for the ramp to carry — and
// the setting is a fetch input, so a checkbox that did nothing would still have
// refetched identical cells. Driven off a real display, because the row is built
// by the shared `variantTrackMenuItems` both multi-sample variant displays take.
test('the dosage ramp is offered in allele-count mode only', () => {
  const offers = (mode: string) => {
    const { display } = createTestEnvironment().createDisplay()
    display.setPhasedMode(mode)
    const colorBy = display
      .trackMenuItems()
      .find(item => 'label' in item && item.label === 'Color by...')
    return (
      colorBy && 'subMenu' in colorBy ? resolveSubMenu(colorBy) : []
    ).some(item => 'label' in item && item.label === 'Shade by dosage')
  }
  expect(offers('alleleCount')).toBe(true)
  expect(offers('phased')).toBe(false)
})
