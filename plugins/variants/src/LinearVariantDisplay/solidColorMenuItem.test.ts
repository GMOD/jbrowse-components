import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function colorByRows(display: { trackMenuItems: () => MenuItem[] }) {
  const colorBy = display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Color by')
  return colorBy && 'subMenu' in colorBy ? resolveSubMenu(colorBy) : []
}

const labelOf = (item: MenuItem) => ('label' in item ? item.label : '---')

test('a constant cell color ticks Solid color..., and Genotype clears it', () => {
  const { display } = createTestEnvironment().createDisplay()
  const ticked = () =>
    colorByRows(display)
      .filter(item => item.type === 'radio' && item.checked)
      .map(labelOf)
  expect(ticked()).toEqual(['Genotype'])
  display.applyPlot({ encoding: { color: { value: '#ff0000' } } })
  expect(ticked()).toEqual(['Solid color...'])
  const genotype = colorByRows(display).find(
    item => labelOf(item) === 'Genotype',
  ) as { onClick: () => void }
  genotype.onClick()
  expect(ticked()).toEqual(['Genotype'])
  expect(display.colorSetting.value).toBeUndefined()
})
