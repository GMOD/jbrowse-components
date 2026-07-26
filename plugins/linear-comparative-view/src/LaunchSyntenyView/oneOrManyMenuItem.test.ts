import PlaceholderIcon from '@mui/icons-material/CompareArrows'

import { oneOrManyMenuItem } from './oneOrManyMenuItem.ts'

import type { MenuItem } from '@jbrowse/core/ui'

const selected: string[] = []

function build(entries: string[]) {
  selected.length = 0
  return oneOrManyMenuItem({
    label: 'Linear synteny view of selection',
    icon: PlaceholderIcon,
    entries,
    entryLabel: entry => `${entry} name`,
    onSelect: entry => () => {
      selected.push(entry)
    },
  })
}

function labelOf(item: MenuItem | undefined) {
  return item && 'label' in item ? item.label : undefined
}

function subMenu(item: MenuItem | undefined) {
  return item && 'subMenu' in item ? item.subMenu : undefined
}

function click(item: MenuItem | undefined) {
  if (item && 'onClick' in item) {
    item.onClick()
  }
}

// nothing capable means no menu clutter at all, rather than a dead entry
test('no entries gives no menu item', () => {
  expect(build([])).toEqual([])
})

// a submenu of one is a needless extra click
test('one entry gives a flat item that selects it', () => {
  const [item] = build(['ava'])
  expect(labelOf(item)).toBe('Linear synteny view of selection')
  expect(subMenu(item)).toBeUndefined()
  click(item)
  expect(selected).toEqual(['ava'])
})

// which dataset the new view is cut from is a real choice once there are several
test('several entries become a submenu naming each', () => {
  const [item] = build(['ava', 'pggb'])
  expect(labelOf(item)).toBe('Linear synteny view of selection')
  expect(subMenu(item)?.map(labelOf)).toEqual(['ava name', 'pggb name'])
  click(subMenu(item)?.[1])
  expect(selected).toEqual(['pggb'])
})
