import {
  laneHeaderMenuItems,
  laneLocString,
  laneOrderMenuItem,
  laneRowMenuItems,
  moveLane,
} from './menus.ts'

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

function headerModel(held = true) {
  const calls: string[] = []
  const model = {
    rowAssemblies: ['peach', 'cacao'],
    rowOrder: [],
    setRowOrder: (order: string[]) => {
      calls.push(`order ${order.join(',')}`)
    },
    hiddenLanes: [],
    setHiddenLanes: (names: string[]) => {
      calls.push(`hide ${names.join(',')}`)
    },
    anchorLocString: 'chr1:1-1,000',
    holdsAssembly: () => held,
    openInNewView: (name: string, loc: string) => {
      calls.push(`open ${name} ${loc}`)
    },
    reanchor: (name: string, loc: string) => {
      calls.push(`reanchor ${name} ${loc}`)
    },
  }
  return { model, calls }
}

const click = (item: MenuItem | undefined) => {
  ;(item as { onClick: () => void }).onClick()
}
const disabledOf = (items: MenuItem[]) =>
  items.map(item => ('label' in item ? !!item.disabled : undefined))

test('the track submenu and the header menu share one row per lane', () => {
  const { model, calls } = headerModel()
  const row = laneRowMenuItems(model, 'cacao')
  expect(labelsOf(row)).toEqual(['Move up', 'Move down', 'Hide lane'])
  expect(disabledOf(row)).toEqual([false, true, false])
  click(row[0])
  click(row[2])
  expect(calls).toEqual(['order cacao,peach', 'hide cacao'])
  expect(
    labelsOf(subMenuOf(subMenuOf(laneOrderMenuItem(model)[0])[1])),
  ).toEqual(labelsOf(row))
})

test('a lane the stack does not hold has no direction to move in', () => {
  const { model } = headerModel()
  expect(disabledOf(laneRowMenuItems(model, 'nobody'))).toEqual([
    true,
    true,
    false,
  ])
})

const peach = {
  assemblyName: 'peach',
  isAnchor: false,
  frame: {
    refName: 'pp1',
    min: 99.6,
    max: 2000.2,
    flipped: false,
    fitMin: 100,
    fitMax: 2000,
  },
  canon: (ref: string) => ref.replace('pp', 'Pp'),
}

test("a mate lane's frame becomes a locstring in the lane assembly's own names", () => {
  expect(laneLocString(peach)).toBe('Pp1:100-2,000')
  expect(laneLocString({ ...peach, frame: undefined })).toBeUndefined()
  expect(
    laneLocString({ ...peach, frame: { ...peach.frame, min: -40, max: 0.2 } }),
  ).toBe('Pp1:0-1')
})

test('a mate lane header opens its assembly elsewhere or re-anchors the track on it', () => {
  const { model, calls } = headerModel()
  const items = laneHeaderMenuItems(model, peach)
  expect(labelsOf(items)).toEqual([
    'Move up',
    'Move down',
    'Hide lane',
    '—',
    'Open peach in a new view',
    'Re-anchor on peach',
  ])
  click(items[4])
  click(items[5])
  expect(calls).toEqual([
    'open peach Pp1:100-2,000',
    'reanchor peach Pp1:100-2,000',
  ])
})

test('the two hops are dead without a frame, and without the genome in the session', () => {
  const hops = (items: MenuItem[]) => disabledOf(items).slice(4)
  expect(hops(laneHeaderMenuItems(headerModel().model, peach))).toEqual([
    false,
    false,
  ])
  expect(
    hops(
      laneHeaderMenuItems(headerModel().model, { ...peach, frame: undefined }),
    ),
  ).toEqual([true, true])
  expect(hops(laneHeaderMenuItems(headerModel(false).model, peach))).toEqual([
    true,
    true,
  ])
})

test('the anchor lane header only opens the view region elsewhere', () => {
  const { model, calls } = headerModel()
  const items = laneHeaderMenuItems(model, {
    assemblyName: 'grape',
    isAnchor: true,
    frame: undefined,
    canon: ref => ref,
  })
  expect(labelsOf(items)).toEqual(['Open grape in a new view'])
  click(items[0])
  expect(calls).toEqual(['open grape chr1:1-1,000'])
})
