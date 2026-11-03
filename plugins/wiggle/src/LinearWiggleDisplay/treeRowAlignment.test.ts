import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment, makeSource } from './testEnv.ts'

function leafCentres(node: {
  x: number
  children?: unknown[] | null
}): number[] {
  const children = node.children as (typeof node)[] | null | undefined
  return children?.length ? children.flatMap(leafCentres) : [node.x]
}

test('a row focus keeps the dendrogram leaves on the row centres', () => {
  const { display, view } = createTestEnvironment().createDisplay()
  display.setRpcData(
    0,
    { sources: ['a', 'b', 'c', 'd'].map(makeSource) },
    view.displayedRegions[0],
  )
  display.setRowLayout(true)
  display.setRowOrder(
    ['a', 'b', 'c', 'd'].map(name => ({ name })),
    { tree: '((a,b),(c,d));' },
  )
  display.setRowFocus(['a', 'b'])

  expect(display.rowFocusLineHeight).toBeGreaterThan(0)
  const { effectiveRowHeight } = display
  const centres = leafCentres(display.hierarchy!)
  expect(centres).toHaveLength(2)
  for (const [i, centre] of centres.entries()) {
    expect(centre).toBeCloseTo((i + 0.5) * effectiveRowHeight)
  }
})

// What the RowArrangement `tree` slot's doc says: the rows follow rows.sort,
// not the tree
test('a tree with no sort keeps the source order and draws only where its leaves list it', () => {
  const { display, view } = createTestEnvironment().createDisplay()
  display.setRpcData(
    0,
    { sources: ['a', 'b', 'c', 'd'].map(makeSource) },
    view.displayedRegions[0],
  )
  display.setRowLayout(true)
  setConf(display.configuration, ['rows', 'tree'], '((d,c),(b,a));')
  expect(display.sources.map(s => s.name)).toEqual(['a', 'b', 'c', 'd'])
  expect(display.hierarchy).toBeUndefined()
  setConf(display.configuration, ['rows', 'tree'], '((a,b),(c,d));')
  expect(display.hierarchy).toBeDefined()
})
