import { colorByMenuItem, solidColorItem } from './colorByMenu.ts'

import type { MenuItem } from '@jbrowse/core/ui'

const radio = (label: string): MenuItem => ({
  label,
  type: 'radio',
  checked: false,
  onClick: () => {},
})

function shape(items: MenuItem[]) {
  return items.map(item =>
    item.type === 'divider'
      ? '---'
      : item.type === 'subHeader'
        ? `# ${item.label}`
        : item.label,
  )
}

test('each block in turn, a pin after a divider, then Additional coloring', () => {
  const item = colorByMenuItem({
    blocks: [
      {
        rows: [radio('Normal'), radio('Strand')],
        pin: { label: 'Pin distinct colors', onClick: () => {} },
      },
      { header: 'Per-base coloring', rows: [radio('None')] },
    ],
    additional: [{ label: 'Arc color', subMenu: [] }],
  })
  expect(item.label).toBe('Color by...')
  expect(shape(item.subMenu)).toEqual([
    'Normal',
    'Strand',
    '---',
    'Pin distinct colors',
    '# Per-base coloring',
    'None',
    '# Additional coloring',
    'Arc color',
  ])
})

test('a block or the additional rows with nothing to offer leave no header', () => {
  const item = colorByMenuItem({
    blocks: [
      { header: 'Cells', rows: [radio('Genotype')] },
      { header: 'Samples', rows: [] },
    ],
  })
  expect(shape(item.subMenu)).toEqual(['# Cells', 'Genotype'])
})

test('Solid color... is a radio that closes the menu to open its picker', () => {
  expect(solidColorItem(true, () => {})).toMatchObject({
    label: 'Solid color...',
    type: 'radio',
    checked: true,
    keepMenuOpen: false,
  })
})
