import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { VariantUnit } from '../shared/constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Phased rows are haplotypes, so there is no dosage for the ramp to carry, and
// a checkbox there would do nothing.
test('the dosage ramp is offered in allele-count mode only', () => {
  const offers = (unit: VariantUnit) => {
    const { display } = createTestEnvironment().createDisplay()
    display.setUnit(unit)
    const colorBy = display
      .trackMenuItems()
      .find(item => 'label' in item && item.label === 'Color by...')
    return (
      colorBy && 'subMenu' in colorBy ? resolveSubMenu(colorBy) : []
    ).some(item => 'label' in item && item.label === 'Shade by dosage')
  }
  expect(offers('sample')).toBe(true)
  expect(offers('haplotype')).toBe(false)
})

function colorByRows(display: { trackMenuItems: () => MenuItem[] }) {
  const colorBy = display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Color by...')
  return colorBy && 'subMenu' in colorBy ? resolveSubMenu(colorBy) : []
}

const labelOf = (item: MenuItem) => ('label' in item ? item.label : '---')

test('the dosage ramp sits under Additional coloring, below the cell fills', () => {
  const { display } = createTestEnvironment().createDisplay()
  const labels = colorByRows(display).map(labelOf)
  expect(labels.indexOf('Solid color...')).toBeLessThan(
    labels.indexOf('Additional coloring'),
  )
  expect(labels.indexOf('Additional coloring')).toBeLessThan(
    labels.indexOf('Shade by dosage'),
  )
})

test('a constant cell colour ticks Solid color..., and Genotype clears it', () => {
  const { display } = createTestEnvironment().createDisplay()
  const ticked = () =>
    colorByRows(display)
      .filter(item => item.type === 'radio' && item.checked)
      .map(labelOf)
  expect(ticked()).toEqual(['Genotype'])
  display.setColor({ value: '#ff0000' })
  expect(ticked()).toEqual(['Solid color...'])
  const genotype = colorByRows(display).find(
    item => labelOf(item) === 'Genotype',
  ) as { onClick: () => void }
  genotype.onClick()
  expect(ticked()).toEqual(['Genotype'])
  expect(display.colorSetting.value).toBeUndefined()
})
