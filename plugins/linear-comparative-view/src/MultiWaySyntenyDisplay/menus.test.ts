import { laneOrderMenuItem, moveLane } from './menus.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function labelsOf(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : '—'))
}

function subMenuOf(item: MenuItem | undefined) {
  return item && 'subMenu' in item ? item.subMenu : []
}

test('a lane moves one place and the others keep their order', () => {
  expect(moveLane(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
  expect(moveLane(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
})

test('a lane at the end of the stack does not fall off it', () => {
  expect(moveLane(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
  expect(moveLane(['a', 'b'], 'b', 1)).toEqual(['a', 'b'])
  expect(moveLane(['a', 'b'], 'nobody', -1)).toEqual(['a', 'b'])
})

// The order written back is the WHOLE stack, not the one lane that moved:
// `rowOrder` pins what it names and leaves the rest densest-first, so pinning
// one lane would let the others re-sort under it between two moves.
test('moving one lane pins every lane, in the order now shown', () => {
  const written: string[][] = []
  const items = laneOrderMenuItem({
    rowAssemblies: ['peach', 'cacao', 'grape'],
    rowOrder: [],
    setRowOrder: order => {
      written.push(order)
    },
    hiddenLanes: [],
    setHiddenLanes: () => {},
  })
  const lanes = subMenuOf(items[0])
  expect(labelsOf(lanes)).toEqual([
    'peach',
    'cacao',
    'grape',
    '—',
    'Reset lane order',
  ])

  const cacao = subMenuOf(lanes[1])
  expect(labelsOf(cacao)).toEqual(['Move up', 'Move down', 'Hide lane'])
  ;(cacao[0] as { onClick: () => void }).onClick()
  expect(written).toEqual([['cacao', 'peach', 'grape']])
})

test('the ends of the stack cannot move past themselves, and reset is dead with nothing pinned', () => {
  const items = laneOrderMenuItem({
    rowAssemblies: ['peach', 'cacao'],
    rowOrder: [],
    setRowOrder: () => {},
    hiddenLanes: [],
    setHiddenLanes: () => {},
  })
  const lanes = subMenuOf(items[0])
  const disabled = (item: MenuItem | undefined) =>
    item && 'disabled' in item ? item.disabled : undefined
  expect(subMenuOf(lanes[0]).map(disabled)).toEqual([true, false])
  expect(subMenuOf(lanes[1]).map(disabled)).toEqual([false, true])
  expect(disabled(lanes[3])).toBe(true)
})

test('one lane has no order to edit', () => {
  expect(
    laneOrderMenuItem({
      rowAssemblies: ['peach'],
      rowOrder: [],
      setRowOrder: () => {},
      hiddenLanes: [],
      setHiddenLanes: () => {},
    }),
  ).toEqual([])
})

test('a lane hides from its own row and comes back from a row of its own', () => {
  const written: string[][] = []
  const model = {
    rowAssemblies: ['peach', 'cacao'],
    rowOrder: [],
    setRowOrder: () => {},
    hiddenLanes: ['grape'],
    setHiddenLanes: (names: string[]) => {
      written.push(names)
    },
  }
  const lanes = subMenuOf(laneOrderMenuItem(model)[0])
  expect(labelsOf(lanes)).toEqual([
    'peach',
    'cacao',
    'Show grape',
    '—',
    'Reset lane order',
  ])
  expect(labelsOf(subMenuOf(lanes[0]))).toEqual([
    'Move up',
    'Move down',
    'Hide lane',
  ])
  ;(subMenuOf(lanes[0])[2] as { onClick: () => void }).onClick()
  ;(lanes[2] as { onClick: () => void }).onClick()
  expect(written).toEqual([['grape', 'peach'], []])
})

test('one lane still has a menu while another is hidden', () => {
  const items = laneOrderMenuItem({
    rowAssemblies: ['peach'],
    rowOrder: [],
    setRowOrder: () => {},
    hiddenLanes: ['cacao'],
    setHiddenLanes: () => {},
  })
  expect(labelsOf(subMenuOf(items[0]))).toContain('Show cacao')
})
