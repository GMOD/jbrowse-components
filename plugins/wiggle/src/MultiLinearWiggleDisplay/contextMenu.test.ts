import { waitFor } from '@testing-library/react'

import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleHoveredFeature } from '../util.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The hit the component resolves alongside the column, for the two items that
// are about one bin rather than about the row order.
const binAt50: WiggleHoveredFeature = {
  refName: 'ctgA',
  start: 0,
  end: 100,
  rows: [{ source: 'b', score: 5 }],
}

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
//
// The region is registered alongside its data, as a real fetch does: the sort
// names a coordinate, so it resolves which loaded region covers it.
function makeDisplay(scores: Record<string, number>, renderingType?: string) {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, {
    sources: Object.entries(scores).map(([name, s]) => scored(name, s)),
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
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
    refName: 'ctgA',
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
    refName: 'ctgA',
    bp: 50,
  })
  const items = display.contextMenuItems()
  display.closeContextMenu()

  click(items, 'Sort rows by score here')

  expect(display.sources.map(s => s.name)).toEqual(['b', 'a'])
})

test('keeps a per-source color across the reorder', () => {
  const display = makeDisplay({ a: 1, b: 5 })
  display.setLayout([{ name: 'a', color: 'red' }, { name: 'b' }])
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    refName: 'ctgA',
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
    refName: 'ctgA',
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
    refName: 'ctgA',
    bp: 50,
  })

  expect(labels(display.contextMenuItems())).toEqual([])
})

test('does nothing when the clicked region has since been discarded', () => {
  const display = makeDisplay({ a: 1, b: 5 })
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    refName: 'ctgA',
    bp: 50,
  })
  const items = display.contextMenuItems()
  display.clearDisplaySpecificData()

  click(items, 'Sort rows by score here')

  expect(display.layout).toEqual([])
})

test('leaves the rows alone at a position no loaded region covers', () => {
  // ranking every row as "no score" would reorder nothing but still write a
  // layout, so the reset item would appear for a sort that never happened
  const display = makeDisplay({ a: 1, b: 5 })

  display.sortRowsByScoreAt('ctgB', 50)

  expect(display.layout).toEqual([])
})

// The right-click item is gated on the row count already (it is absent below
// two rows, above), but `sortRowsByScoreAt` is also the declarative
// `sortRowsBy` entry point a session spec reaches directly, and a write there
// is not a harmless no-op: `setLayout` drops the cluster tree whenever the row
// set changes, so one source would trade a dendrogram for a layout naming the
// only row there is. The multi-row feature display's twin carries the same
// guard.
test('sorts nothing when there is a single row to order', () => {
  const display = makeDisplay({ a: 1 })

  display.sortRowsByScoreAt('ctgA', 50)

  expect(display.layout).toEqual([])
})

// The same two rows the multi-row painting and the variant displays offer, so
// one action is not three names across three displays. They come off the hit
// under the pointer, where the sort comes off the column.
describe('the rows about the clicked bin', () => {
  it('offers them beside the sort', () => {
    const display = makeDisplay({ a: 1, b: 5 })
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      refName: 'ctgA',
      bp: 50,
      feature: binAt50,
    })

    expect(labels(display.contextMenuItems())).toEqual([
      'Sort rows by score here',
      'Open feature details',
      'Copy location',
    ])
  })

  // The sort has no row axis to rank down in an overlay, but the bin under the
  // pointer is still a record.
  it('offers them in an overlay mode, where the sort is dropped', () => {
    const display = makeDisplay({ a: 1, b: 5 }, 'multixyplot')
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      refName: 'ctgA',
      bp: 50,
      feature: binAt50,
    })

    expect(labels(display.contextMenuItems())).toEqual([
      'Open feature details',
      'Copy location',
    ])
  })

  it('leaves them out in a gap, where there is no record to open or paste', () => {
    const display = makeDisplay({ a: 1, b: 5 })
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      refName: 'ctgA',
      bp: 50,
    })

    expect(labels(display.contextMenuItems())).toEqual([
      'Sort rows by score here',
    ])
  })

  it('copies the bin as a locString', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    })
    const display = makeDisplay({ a: 1, b: 5 })
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      refName: 'ctgA',
      bp: 50,
      feature: binAt50,
    })

    click(display.contextMenuItems(), 'Copy location')

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('ctgA:1..100')
    })
  })
})
