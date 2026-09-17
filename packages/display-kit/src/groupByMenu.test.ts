import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import {
  mergeDomain,
  moveSectionTo,
  sectionOrderMenuItems,
} from './groupByMenu.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function labelsOf(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : '—'))
}

function subMenuOf(item: MenuItem | undefined) {
  return item && 'subMenu' in item ? resolveSubMenu(item) : []
}

function clickOf(item: MenuItem | undefined) {
  if (item && 'onClick' in item) {
    item.onClick(undefined)
  }
}

function disabledOf(item: MenuItem | undefined) {
  return item && 'disabled' in item ? item.disabled : undefined
}

function sections(...keys: string[]) {
  return keys.map(key => ({ key, label: key.toUpperCase() }))
}

test('a reorder keeps the pinned sections it could not see, at their own index', () => {
  expect(
    mergeDomain(['peach', 'cacao', 'poplar'], ['poplar', 'peach']),
  ).toEqual(['poplar', 'cacao', 'peach'])
  expect(mergeDomain(['a', 'b'], ['b', 'a'])).toEqual(['b', 'a'])
  expect(mergeDomain([], ['a', 'b'])).toEqual(['a', 'b'])
})

test('a move clamps to the ends and ignores a key it does not hold', () => {
  expect(moveSectionTo(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
  expect(moveSectionTo(['a', 'b', 'c'], 'c', -1)).toEqual(['c', 'a', 'b'])
  expect(moveSectionTo(['a', 'b'], 'b', 2)).toEqual(['a', 'b'])
  expect(moveSectionTo(['a', 'b'], 'nobody', 0)).toEqual(['a', 'b'])
})

test('moving one section pins every drawn section, in the order now shown', () => {
  const written: string[][] = []
  const items = sectionOrderMenuItems({
    sections: sections('peach', 'cacao', 'grape'),
    domain: ['hidden'],
    setDomain: domain => {
      written.push(domain)
    },
    hideGroup: () => {},
  })
  expect(labelsOf(items)).toEqual(['Sections'])
  const rows = subMenuOf(items[0])
  expect(labelsOf(rows)).toEqual([
    'PEACH',
    'CACAO',
    'GRAPE',
    '—',
    'Reset section order',
  ])
  expect(labelsOf(subMenuOf(rows[1]))).toEqual([
    'Move up',
    'Move down',
    'Hide section',
  ])
  clickOf(subMenuOf(rows[1])[0])
  expect(written).toEqual([['hidden', 'cacao', 'peach', 'grape']])
  clickOf(rows[4])
  expect(written[1]).toEqual([])
})

test('the ends cannot move past themselves, reset is dead with nothing pinned, and one section offers no menu', () => {
  const model = {
    sections: sections('peach', 'cacao'),
    domain: [],
    setDomain: () => {},
    hideGroup: () => {},
  }
  const rows = subMenuOf(sectionOrderMenuItems(model)[0])
  expect(labelsOf(rows)).toEqual(['PEACH', 'CACAO', '—', 'Reset section order'])
  expect(subMenuOf(rows[0]).map(disabledOf)).toEqual([true, false, false])
  expect(subMenuOf(rows[1]).map(disabledOf)).toEqual([false, true, false])
  expect(disabledOf(rows[3])).toBe(true)
  expect(
    sectionOrderMenuItems({ ...model, sections: sections('peach') }),
  ).toEqual([])
})
