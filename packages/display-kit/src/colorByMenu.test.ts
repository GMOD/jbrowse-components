import {
  colorByMenuItem,
  colorFieldRows,
  solidColorItem,
} from './colorByMenu.ts'

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

test('each block in turn, then Additional coloring', () => {
  const item = colorByMenuItem({
    blocks: [
      { rows: [radio('Normal'), radio('Strand')] },
      { header: 'Per-base coloring', rows: [radio('None')] },
    ],
    additional: [{ label: 'Arc color', subMenu: [] }],
  })
  expect(item.label).toBe('Color by...')
  expect(shape(item.subMenu)).toEqual([
    'Normal',
    'Strand',
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

function fieldRows(colorByMode: string, checked: boolean, calls: string[]) {
  return colorFieldRows(
    {
      colorByMode,
      pickDefaultColor: () => calls.push('default'),
      pickSolidColor: () => calls.push('solid'),
      openColorByAttributeDialog: () => calls.push('dialog'),
      colorByField: field => calls.push(`field ${field}`),
      setShowLegend: show => calls.push(`legend ${show}`),
    },
    [{ label: 'SV type', field: 'svType', checked }],
  )
}

test('a painting preset is ticked in place of Attribute...', () => {
  const checked = (rows: MenuItem[]) =>
    rows.flatMap(r => ('checked' in r && r.checked ? [r.label] : []))
  expect(checked(fieldRows('attribute', true, []))).toEqual(['SV type'])
  expect(checked(fieldRows('attribute', false, []))).toEqual(['Attribute...'])
})

test('a preset shows its key as it paints', () => {
  const calls: string[] = []
  const row = fieldRows('default', false, calls).find(
    r => 'label' in r && r.label === 'SV type',
  )
  if (!row || !('onClick' in row)) {
    throw new Error('expected the preset row')
  }
  row.onClick()
  expect(calls).toEqual(['legend true', 'field svType'])
})
