import { resolveSubMenu } from './MenuTypes.ts'
import { filterMenuItems } from './filterMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { Reversibles } from './filterMenuItems.ts'

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

function filter(count: number): Reversibles {
  return { filter: { count, clear: () => {} } }
}

test('a lone dialog opener stays a top-level row', () => {
  const items = filterMenuItems({ narrowings: filter(0), onEdit: () => {} })
  expect(labels(items)).toEqual(['Filter by...'])
  expect(items[0] && 'subMenu' in items[0]).toBe(false)
})

test('the count rides the label once something is filtering', () => {
  const items = filterMenuItems({ narrowings: filter(3), onEdit: () => {} })
  expect(labels(items)).toEqual(['Filter by... (3)'])
})

// The recovery row is the whole reason the group earns a submenu, so it may not
// appear while nothing is filtering — a "Clear all filters" on an unfiltered
// track is a button that does nothing.
test('Clear all filters appears only while a filter is on', () => {
  const unfiltered = filterMenuItems({
    narrowings: filter(0),
    onEdit: () => {},
  })
  expect(labels(unfiltered)).toEqual(['Filter by...'])

  const filtered = filterMenuItems({ narrowings: filter(1), onEdit: () => {} })
  expect(labels(filtered)).toEqual(['Filter by... (1)'])
  expect(labels(subMenu(filtered))).toEqual([
    'Edit filters...',
    'Clear all filters',
  ])
})

test('Clear all filters clears every narrowing', () => {
  const cleared: string[] = []
  const items = filterMenuItems({
    narrowings: {
      a: { count: 1, clear: () => cleared.push('a') },
      b: { count: 0, clear: () => cleared.push('b') },
    },
    onEdit: () => {},
  })
  const clear = subMenu(items).find(
    i => 'label' in i && i.label === 'Clear all filters',
  )
  if (!clear || !('onClick' in clear)) {
    throw new Error('expected a clear row')
  }
  clear.onClick()
  expect(cleared).toEqual(['a', 'b'])
})

test('sub-items and undo rows order after the dialog opener', () => {
  const items = filterMenuItems({
    narrowings: {
      filter: { count: 1, clear: () => {} },
      hidden: {
        count: 1,
        label: n => `Show ${n} hidden feature`,
        clear: () => {},
      },
    },
    onEdit: () => {},
    subItems: [{ label: 'Minor allele frequency', onClick: () => {} }],
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
  expect(filterMenuItems({ narrowings: filter(0) })).toEqual([])
})

// The priority belongs to the row the track menu sorts, never to the opener
// inside the submenu, where it would sort below the recovery rows it heads.
test('priority rides the top-level row in both shapes', () => {
  const flat = filterMenuItems({
    narrowings: filter(0),
    onEdit: () => {},
    priority: -100,
  })
  expect(flat[0] && 'priority' in flat[0] && flat[0].priority).toBe(-100)

  const nested = filterMenuItems({
    narrowings: filter(1),
    onEdit: () => {},
    priority: -100,
  })
  expect(nested[0] && 'priority' in nested[0] && nested[0].priority).toBe(-100)
  expect(subMenu(nested).every(i => !('priority' in i && i.priority))).toBe(
    true,
  )
})
