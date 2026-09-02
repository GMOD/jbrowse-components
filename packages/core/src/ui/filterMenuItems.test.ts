import { resolveSubMenu } from './MenuTypes.ts'
import { filterMenuItems } from './filterMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'

function labels(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : undefined))
}

function subMenu(items: MenuItem[]) {
  const [item] = items
  if (!item || !('subMenu' in item)) {
    throw new Error('expected a submenu')
  }
  return resolveSubMenu(item)
}

test('a lone dialog opener stays a top-level row', () => {
  const items = filterMenuItems({ activeCount: 0, onEdit: () => {} })
  expect(labels(items)).toEqual(['Filter by...'])
  expect(items[0] && 'subMenu' in items[0]).toBe(false)
})

test('the count rides the label once something is filtering', () => {
  expect(labels(filterMenuItems({ activeCount: 3, onEdit: () => {} }))).toEqual(
    ['Filter by... (3)'],
  )
})

// The recovery row is the whole reason the group earns a submenu, so it may not
// appear while nothing is filtering — a "Clear all filters" on an unfiltered
// track is a button that does nothing.
test('Clear all filters appears only while a filter is on', () => {
  const unfiltered = filterMenuItems({
    activeCount: 0,
    onEdit: () => {},
    onClear: () => {},
  })
  expect(labels(unfiltered)).toEqual(['Filter by...'])

  const filtered = filterMenuItems({
    activeCount: 1,
    onEdit: () => {},
    onClear: () => {},
  })
  expect(labels(filtered)).toEqual(['Filter by... (1)'])
  expect(labels(subMenu(filtered))).toEqual([
    'Edit filters...',
    'Clear all filters',
  ])
})

test('sub-items and recovery rows order after the dialog opener', () => {
  const items = filterMenuItems({
    activeCount: 2,
    onEdit: () => {},
    subItems: [{ label: 'Minor allele frequency', onClick: () => {} }],
    recoveryItems: [{ label: 'Show 1 hidden feature', onClick: () => {} }],
    onClear: () => {},
  })
  expect(labels(subMenu(items))).toEqual([
    'Edit filters...',
    'Minor allele frequency',
    'Show 1 hidden feature',
    'Clear all filters',
  ])
})

// A pre-computed LD file has nothing to filter: spread, don't insert.
test('a display with no dialog and no sub-items contributes no row', () => {
  expect(filterMenuItems({ activeCount: 0 })).toEqual([])
})

// The priority belongs to the row the track menu sorts, never to the opener
// inside the submenu, where it would sort below the recovery rows it heads.
test('priority rides the top-level row in both shapes', () => {
  const flat = filterMenuItems({
    activeCount: 0,
    onEdit: () => {},
    priority: -100,
  })
  expect(flat[0] && 'priority' in flat[0] && flat[0].priority).toBe(-100)

  const nested = filterMenuItems({
    activeCount: 1,
    onEdit: () => {},
    onClear: () => {},
    priority: -100,
  })
  expect(nested[0] && 'priority' in nested[0] && nested[0].priority).toBe(-100)
  expect(subMenu(nested).every(i => !('priority' in i && i.priority))).toBe(
    true,
  )
})
