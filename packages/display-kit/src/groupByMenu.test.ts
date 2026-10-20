import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'

import {
  groupByRadioMenuItem,
  mergeDomain,
  moveSectionOnto,
  moveSectionTo,
  resetSectionOrderItems,
} from './groupByMenu.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function labelsOf(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : '—'))
}

function clickOf(item: MenuItem | undefined) {
  if (item && 'onClick' in item) {
    item.onClick(undefined)
  }
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

test('a drop pins every drawn section in the order now shown, and a drop on itself writes nothing', () => {
  const written: string[][] = []
  const model = {
    sections: sections('peach', 'cacao', 'grape'),
    domain: ['hidden'],
    setDomain: (domain: string[]) => {
      written.push(domain)
    },
  }
  moveSectionOnto(model, 'cacao', 'peach')
  moveSectionOnto(model, 'grape', 'grape')
  moveSectionOnto(model, 'grape', 'nobody')
  expect(written).toEqual([['hidden', 'cacao', 'peach', 'grape']])
})

test('the overflow section neither moves nor lands in the domain', () => {
  const written: string[][] = []
  const model = {
    sections: sections('peach', 'cacao', OVERFLOW_GROUP_KEY),
    domain: [],
    setDomain: (domain: string[]) => {
      written.push(domain)
    },
  }
  moveSectionOnto(model, OVERFLOW_GROUP_KEY, 'peach')
  moveSectionOnto(model, 'peach', OVERFLOW_GROUP_KEY)
  expect(written).toEqual([['cacao', 'peach']])
})

test('the reset row shows only while the order is pinned, and clears it', () => {
  const written: string[][] = []
  const setDomain = (domain: string[]) => {
    written.push(domain)
  }
  expect(resetSectionOrderItems(undefined)).toEqual([])
  expect(resetSectionOrderItems({ domain: [], setDomain })).toEqual([])
  const rows = resetSectionOrderItems({ domain: ['b'], setDomain })
  expect(labelsOf(rows)).toEqual(['Reset section order'])
  clickOf(rows[0])
  expect(written).toEqual([[]])
})

test('a stored field no radio offers shows checked and disabled, one not honored ticks None', () => {
  const ticked = (current: string, offered?: (type: string) => boolean) =>
    groupByRadioMenuItem({
      current,
      options: [{ type: 'population', label: 'Population' }],
      onSelect: () => {},
      onNone: () => {},
      offered,
    }).subMenu.flatMap(item =>
      'checked' in item && item.checked
        ? [[item.label, 'disabled' in item && !!item.disabled]]
        : [],
    )
  expect(ticked('population')).toEqual([['Population', false]])
  expect(ticked('superpopulation')).toEqual([['superpopulation', true]])
  expect(ticked('superpopulation', type => type === 'population')).toEqual([
    ['None', false],
  ])
})
