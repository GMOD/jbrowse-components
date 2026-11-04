import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui/menuItems'

import { rowHeightMenuItem } from './rowHeightMenu.ts'

import type { RowHeightModel } from './rowHeightMenu.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RowStep } from '@jbrowse/core/util/resolveRowHeight'

const PRESETS = [
  { label: 'Normal', rowHeight: 15, rowProportion: 0.8 },
  { label: 'Compact', rowHeight: 8, rowProportion: 0.9 },
]

function makeModel(rowStep: RowStep, extra?: Partial<RowHeightModel>) {
  return {
    rowStep,
    setRowHeight: jest.fn(),
    setFitToHeight: jest.fn(),
    ...extra,
  } as unknown as RowHeightModel & {
    setRowHeight: jest.Mock
    setFitToHeight: jest.Mock
  }
}

function subMenu(model: RowHeightModel, presets = PRESETS) {
  const item = rowHeightMenuItem(model, presets)
  if (!('subMenu' in item)) {
    throw new Error('expected a submenu')
  }
  return resolveSubMenu(item)
}

function labels(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : undefined))
}

function checkedLabel(items: MenuItem[]) {
  return items
    .filter(i => 'checked' in i && i.checked)
    .map(i => ('label' in i ? i.label : undefined))
}

// The one coupled axis: 'fit' is fit, a preset value is that preset, anything
// else is the leftover "Custom..." row. Exactly one is ever checked.
test.each<[RowStep, string]>([
  ['fit', 'Fit to track height'],
  [15, 'Normal'],
  [8, 'Compact'],
  [23, 'Custom...'],
])('row step %p checks %p', (rowStep, expected) => {
  expect(checkedLabel(subMenu(makeModel(rowStep)))).toEqual([expected])
})

test('a display with no presets still gets fit and custom', () => {
  expect(labels(subMenu(makeModel('fit'), []))).toEqual([
    'Fit to track height',
    'Custom...',
  ])
  expect(checkedLabel(subMenu(makeModel(20), []))).toEqual(['Custom...'])
})

test('a preset writes its proportion only where the display has one', () => {
  const withProportion = makeModel('fit', { setRowProportion: jest.fn() })
  const normal = subMenu(withProportion)[1]!
  if (!('onClick' in normal)) {
    throw new Error('expected a clickable preset')
  }
  normal.onClick()
  expect(withProportion.setRowHeight).toHaveBeenCalledWith(15)
  expect(withProportion.setRowProportion).toHaveBeenCalledWith(0.8)

  // multi-row features and the variant displays have no proportion; the same
  // preset table must not throw on them
  const plain = makeModel('fit')
  const plainNormal = subMenu(plain)[1]!
  if (!('onClick' in plainNormal)) {
    throw new Error('expected a clickable preset')
  }
  expect(() => {
    plainNormal.onClick()
  }).not.toThrow()
  expect(plain.setRowHeight).toHaveBeenCalledWith(15)
})

// Fit is a setting, so it keeps the menu open; the dialog opener is the one row
// that dismisses. Spelled out because CascadingMenu decides from the row type
// and a radio would otherwise stay open behind its own dialog.
test('only the dialog opener dismisses the menu', () => {
  const items = subMenu(makeModel('fit'))
  const custom = items.at(-1)!
  const rest = items.slice(0, -1)
  expect(rest.every(i => 'onClick' in i && staysOpenOnClick(i))).toBe(true)
  expect('onClick' in custom && staysOpenOnClick(custom)).toBe(false)
})

test('the fit radio writes fit, not a height', () => {
  const model = makeModel(20)
  const fit = subMenu(model)[0]!
  if (!('onClick' in fit)) {
    throw new Error('expected a clickable radio')
  }
  fit.onClick()
  expect(model.setFitToHeight).toHaveBeenCalled()
  expect(model.setRowHeight).not.toHaveBeenCalled()
})
