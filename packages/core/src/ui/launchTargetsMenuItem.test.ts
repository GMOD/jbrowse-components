import PlaceholderIcon from '@mui/icons-material/CompareArrows'

import { resolveSubMenu } from './MenuTypes.ts'
import { launchTargetsMenuItem } from './launchTargetsMenuItem.ts'

import type { MenuItem } from './MenuTypes.ts'

const selected: string[] = []

function build(entries: string[]) {
  selected.length = 0
  return launchTargetsMenuItem({
    label: 'Linear synteny view',
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
  return item && 'subMenu' in item ? resolveSubMenu(item) : undefined
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

// the shape does not change with the count: one dataset still says which one,
// where a flat item would have launched off an unnamed dataset
test('one entry still becomes a submenu naming it', () => {
  const [item] = build(['ava'])
  expect(labelOf(item)).toBe('Linear synteny view')
  expect(subMenu(item)?.map(labelOf)).toEqual(['ava name'])
  click(subMenu(item)?.[0])
  expect(selected).toEqual(['ava'])
})

// which dataset the new view is cut from is a real choice once there are several
test('several entries become a submenu naming each', () => {
  const [item] = build(['ava', 'pggb'])
  expect(labelOf(item)).toBe('Linear synteny view')
  expect(subMenu(item)?.map(labelOf)).toEqual(['ava name', 'pggb name'])
  click(subMenu(item)?.[1])
  expect(selected).toEqual(['pggb'])
})
