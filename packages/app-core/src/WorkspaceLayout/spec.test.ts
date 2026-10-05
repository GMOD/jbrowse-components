import { tileLayoutSpec, treeFromSpec, viewIdsInSpec } from './spec.ts'
import { isBranch } from './tree.ts'

import type { BranchNode, LayoutTree, NodeKind, PanelNode } from './tree.ts'

// `treeFromSpec` converts the public `layout` URL parameter, documented in
// `website/docs/urlparams.md`; changing it changes users' saved links

let counter = 0
const nextId = (kind: NodeKind) => `${kind}-${counter++}`
beforeEach(() => {
  counter = 0
})

/** sizes of a branch's children, rounded — they are renormalised to sum to 1 */
function sizes(node: LayoutTree) {
  return (node as BranchNode).children.map(
    c => Math.round(c.size * 1000) / 1000,
  )
}

function viewIdsOf(node: LayoutTree): string[][] {
  return isBranch(node)
    ? node.children.flatMap(viewIdsOf)
    : node.tabs.map(t => t.viewIds)
}

test('a flat split keeps the stated proportions', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { views: ['a'], size: 70 },
        { views: ['b'], size: 30 },
      ],
    },
    nextId,
  )

  expect((tree as BranchNode).direction).toBe('row')
  expect(sizes(tree)).toEqual([0.7, 0.3])
})

test('sizes are proportions, not required to total 100', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { views: ['a'], size: 7 },
        { views: ['b'], size: 3 },
      ],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.7, 0.3])
})

test('a nested split is sized at its own depth', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { views: ['a'], size: 70 },
        {
          direction: 'vertical',
          size: 30,
          children: [
            { views: ['b'], size: 80 },
            { views: ['c'], size: 20 },
          ],
        },
      ],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.7, 0.3])
  const nested = (tree as BranchNode).children[1]!
  expect((nested as BranchNode).direction).toBe('column')
  expect(sizes(nested)).toEqual([0.8, 0.2])
})

// as a plain weight, a bare sibling would be 1 against 70: a 1/71 sliver
test('an unsized sibling takes what the sized ones left over', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [{ views: ['a'], size: 70 }, { views: ['b'] }],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.7, 0.3])
})

// sizes read as weights only when every sibling has one
test('beside a bare sibling, a small size is a percentage and not a weight', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [{ views: ['a'], size: 7 }, { views: ['b'] }],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.07, 0.93])
})

test('several unsized siblings divide the remainder between them', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { views: ['a'], size: 60 },
        { views: ['b'] },
        { views: ['c'] },
      ],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.6, 0.2, 0.2])
})

test('an over-subscribed branch still gives a bare sibling a real share', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { views: ['a'], size: 60 },
        { views: ['b'], size: 40 },
        { views: ['c'] },
      ],
    },
    nextId,
  )

  const [a, b, c] = sizes(tree)
  expect(a).toBeCloseTo(0.4, 2)
  expect(b).toBeCloseTo(0.267, 2)
  expect(c).toBeCloseTo(0.333, 2)
  expect(c).toBeGreaterThan(0.1)
})

test('no sizes at all divides the space evenly', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [{ views: ['a'] }, { views: ['b'] }, { views: ['c'] }],
    },
    nextId,
  )

  // `sizes` rounds to 3dp, so an even third reads as 0.333
  expect(sizes(tree)).toEqual([0.333, 0.333, 0.333])
})

test('direction tabs puts every child in one cell', () => {
  const tree = treeFromSpec(
    {
      direction: 'tabs',
      children: [{ views: ['a'] }, { views: ['b', 'c'] }],
    },
    nextId,
  )

  expect(isBranch(tree)).toBe(false)
  const panel = tree as PanelNode
  expect(panel.tabs.map(t => t.viewIds)).toEqual([['a'], ['b', 'c']])
  expect(panel.activeTabId).toBe(panel.tabs[0]!.id)
})

// a tab holds a flat stack, so a container child flattens into one tab
test('a container inside a tabs node becomes one tab, keeping its views', () => {
  const tree = treeFromSpec(
    {
      direction: 'tabs',
      children: [
        { views: ['a'] },
        {
          direction: 'horizontal',
          children: [{ views: ['b'] }, { views: ['c'] }],
        },
      ],
    },
    nextId,
  )

  expect(isBranch(tree)).toBe(false)
  expect((tree as PanelNode).tabs.map(t => t.viewIds)).toEqual([
    ['a'],
    ['b', 'c'],
  ])
})

test('a tabs node skips a child with no views anywhere under it', () => {
  const tree = treeFromSpec(
    {
      direction: 'tabs',
      children: [{ views: ['a'] }, { direction: 'horizontal', children: [] }],
    },
    nextId,
  )

  expect((tree as PanelNode).tabs.map(t => t.viewIds)).toEqual([['a']])
})

test('a spec with no children at all still yields a usable empty panel', () => {
  const tree = treeFromSpec({ direction: 'horizontal', children: [] }, nextId)

  expect(isBranch(tree)).toBe(false)
  expect((tree as PanelNode).tabs).toEqual([])
})

test('a split with one child collapses to the child', () => {
  const tree = treeFromSpec(
    { direction: 'horizontal', children: [{ views: ['a'], size: 40 }] },
    nextId,
  )

  expect(isBranch(tree)).toBe(false)
  expect((tree as PanelNode).size).toBe(1)
  expect(viewIdsOf(tree)).toEqual([['a']])
})

test('viewIdsInSpec reports every view depth-first, in the order stated', () => {
  expect(
    viewIdsInSpec({
      direction: 'horizontal',
      children: [
        { views: ['a', 'b'] },
        { direction: 'vertical', children: [{ views: ['c'] }] },
      ],
    }),
  ).toEqual(['a', 'b', 'c'])
})

test.each(['tabs', 'horizontal', 'vertical'] as const)(
  'tiling %s gives every view its own cell, in session order',
  mode => {
    expect(tileLayoutSpec(['a', 'b', 'c'], mode)).toEqual({
      direction: mode,
      children: [{ views: ['a'] }, { views: ['b'] }, { views: ['c'] }],
    })
  },
)

test('a grid is rows of ceil(sqrt(n)) columns, filled row-major', () => {
  // 5 views -> 3 columns -> a full row and an unpadded short one
  expect(tileLayoutSpec(['a', 'b', 'c', 'd', 'e'], 'grid')).toEqual({
    direction: 'vertical',
    children: [
      {
        direction: 'horizontal',
        children: [{ views: ['a'] }, { views: ['b'] }, { views: ['c'] }],
      },
      {
        direction: 'horizontal',
        children: [{ views: ['d'] }, { views: ['e'] }],
      },
    ],
  })
})

test.each(['tabs', 'horizontal', 'vertical', 'grid'] as const)(
  'tiling %s with one view is the whole workspace, not a one-child split',
  mode => {
    expect(tileLayoutSpec(['only'], mode)).toEqual({ views: ['only'] })
    expect(tileLayoutSpec([], mode)).toEqual({ views: [] })
  },
)
