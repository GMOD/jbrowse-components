import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// One source with a single [0, 100) feature at `score`, the shape the RPC ships.
function scored(name: string, score: number) {
  return {
    ...makeSource(name),
    featurePositions: new Uint32Array([0, 100]),
    featureScores: new Float32Array([score]),
    numFeatures: 1,
  }
}

// Driven off a real display, like trackMenuItems.test.ts: the menu's gates read
// getters (`isOverlay`, `numSources`, `layout`) a stub would have to restate.
function makeDisplay(scores: Record<string, number>, renderingType?: string) {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, {
    sources: Object.entries(scores).map(([name, s]) => scored(name, s)),
  })
  if (renderingType) {
    display.setRenderingType(renderingType)
  }
  return display
}

function labels(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

function click(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (item && 'onClick' in item) {
    item.onClick()
  } else {
    throw new Error(`item "${label}" not found`)
  }
}

test('has no menu until a right-click names a column', () => {
  const display = makeDisplay({ a: 1, b: 2 })

  expect(display.contextMenuItems()).toEqual([])
})

test('sorts the rows by their score at the clicked column', () => {
  const display = makeDisplay({ a: 1, b: 5, c: 3 })
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    displayedRegionIndex: 0,
    bp: 50,
  })

  click(display.contextMenuItems(), 'Sort rows by score here')

  expect(display.sources.map(s => s.name)).toEqual(['b', 'c', 'a'])
})

test('acts on the column the menu was opened over, not the one it is closed from', () => {
  // closeContextMenu runs before an item's onClick (CascadingMenu's
  // closeAfterItemClick), so the items have to have captured the position
  const display = makeDisplay({ a: 1, b: 5 })
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    displayedRegionIndex: 0,
    bp: 50,
  })
  const items = display.contextMenuItems()
  display.closeContextMenu()

  click(items, 'Sort rows by score here')

  expect(display.sources.map(s => s.name)).toEqual(['b', 'a'])
})

test('keeps a per-source color across the reorder', () => {
  const display = makeDisplay({ a: 1, b: 5 })
  display.setLayout([
    { name: 'a', source: 'a', color: 'red' },
    { name: 'b', source: 'b' },
  ])
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    displayedRegionIndex: 0,
    bp: 50,
  })

  click(display.contextMenuItems(), 'Sort rows by score here')

  expect(display.sources.map(s => [s.name, s.color])).toEqual([
    ['b', undefined],
    ['a', 'red'],
  ])
})

test('offers the reset only once an order has been written', () => {
  const display = makeDisplay({ a: 1, b: 5 })
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    displayedRegionIndex: 0,
    bp: 50,
  })
  expect(labels(display.contextMenuItems())).toEqual([
    'Sort rows by score here',
  ])

  click(display.contextMenuItems(), 'Sort rows by score here')
  expect(labels(display.contextMenuItems())).toEqual([
    'Sort rows by score here',
    'Reset row order',
  ])

  click(display.contextMenuItems(), 'Reset row order')
  expect(display.sources.map(s => s.name)).toEqual(['a', 'b'])
})

test('drops the sort in an overlay mode, which has no row axis to rank down', () => {
  const display = makeDisplay({ a: 1, b: 5 }, 'multixyplot')
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    displayedRegionIndex: 0,
    bp: 50,
  })

  expect(labels(display.contextMenuItems())).toEqual([])
})

test('does nothing when the clicked region has since been discarded', () => {
  const display = makeDisplay({ a: 1, b: 5 })
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    displayedRegionIndex: 0,
    bp: 50,
  })
  const items = display.contextMenuItems()
  display.clearDisplaySpecificData()

  click(items, 'Sort rows by score here')

  expect(display.layout).toEqual([])
})
