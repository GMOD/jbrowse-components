import {
  specForPendingMove,
  tileLayoutSpec,
  treeFromSpec,
  viewIdsInSpec,
} from './spec.ts'
import { isBranch } from './tree.ts'

import type { BranchNode, LayoutTree, NodeKind, PanelNode } from './tree.ts'

/**
 * `treeFromSpec` converts the **public** `layout` URL parameter, so what it does
 * with a given spec is documented behaviour in `website/docs/urlparams.md` and
 * changing it changes a user's saved links.
 */

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
        { viewIds: ['a'], size: 70 },
        { viewIds: ['b'], size: 30 },
      ],
    },
    nextId,
  )

  expect((tree as BranchNode).direction).toBe('row')
  expect(sizes(tree)).toEqual([0.7, 0.3])
})

// Sizes are weights, renormalised — so they need not sum to 100, and a spec
// written in any consistent unit lays out the same way.
test('sizes are proportions, not required to total 100', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { viewIds: ['a'], size: 7 },
        { viewIds: ['b'], size: 3 },
      ],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.7, 0.3])
})

// THE thing the rewrite made possible, and the reason the docs describing it as
// impossible were worth fixing: dockview forced orientation to alternate by
// depth, so a nested split had no branch to size against and every nested size
// was discarded. Here the spec's nesting IS the tree's nesting.
test('a nested split is sized at its own depth', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { viewIds: ['a'], size: 70 },
        {
          direction: 'vertical',
          size: 30,
          children: [
            { viewIds: ['b'], size: 80 },
            { viewIds: ['c'], size: 20 },
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

// `size` is documented as a percentage, so a sibling left bare means "the rest".
// Read as a plain weight it would default to 1 against a 70, and the panel comes
// out at 1/71 of the width — visible in the tree, about a pixel wide on screen,
// and reported by nothing. This case was unreachable while nested layouts were
// discarded wholesale.
test('an unsized sibling takes what the sized ones left over', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [{ viewIds: ['a'], size: 70 }, { viewIds: ['b'] }],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.7, 0.3])
})

// The half of that rule urlparams.md used to state and then contradict: the
// proportions reading ("7 and 3 lay out the same as 70 and 30") holds only when
// every sibling is sized. Beside a bare one the number is a percentage, so 7 is
// a 7% sliver rather than the 70% the same spec means with a 3 written next to
// it.
test('beside a bare sibling, a small size is a percentage and not a weight', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [{ viewIds: ['a'], size: 7 }, { viewIds: ['b'] }],
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
        { viewIds: ['a'], size: 60 },
        { viewIds: ['b'] },
        { viewIds: ['c'] },
      ],
    },
    nextId,
  )

  expect(sizes(tree)).toEqual([0.6, 0.2, 0.2])
})

// Over-subscribed: the stated sizes already reach 100, so there is no remainder
// to hand out. The bare sibling takes a typical share rather than collapsing —
// the spec is malformed and the layout still has to be usable.
test('an over-subscribed branch still gives a bare sibling a real share', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [
        { viewIds: ['a'], size: 60 },
        { viewIds: ['b'], size: 40 },
        { viewIds: ['c'] },
      ],
    },
    nextId,
  )

  const [a, b, c] = sizes(tree)
  expect(a).toBeCloseTo(0.4, 2)
  expect(b).toBeCloseTo(0.267, 2)
  expect(c).toBeCloseTo(0.333, 2)
  // the point of the fallback: it is a share somebody can see and drag
  expect(c).toBeGreaterThan(0.1)
})

test('no sizes at all divides the space evenly', () => {
  const tree = treeFromSpec(
    {
      direction: 'horizontal',
      children: [{ viewIds: ['a'] }, { viewIds: ['b'] }, { viewIds: ['c'] }],
    },
    nextId,
  )

  // `sizes` rounds to 3dp, so an even third reads as 0.333
  expect(sizes(tree)).toEqual([0.333, 0.333, 0.333])
})

// `tabs` is not a split: the children become tabs of ONE cell, so there is no
// space to divide and no sizes to resolve.
test('direction tabs puts every child in one cell', () => {
  const tree = treeFromSpec(
    {
      direction: 'tabs',
      children: [{ viewIds: ['a'] }, { viewIds: ['b', 'c'] }],
    },
    nextId,
  )

  expect(isBranch(tree)).toBe(false)
  const panel = tree as PanelNode
  expect(panel.tabs.map(t => t.viewIds)).toEqual([['a'], ['b', 'c']])
  expect(panel.activeTabId).toBe(panel.tabs[0]!.id)
})

// A tab holds a flat stack of views, so a container child of a `tabs` node has
// no split to become — and containers nest arbitrarily deep everywhere else, so
// one can be written. Flattened into a single tab, NOT dropped: dropping it
// left those views in no tab at all, and homing then swept them into whichever
// tab happened to be showing. The layout came out wrong with nothing said.
test('a container inside a tabs node becomes one tab, keeping its views', () => {
  const tree = treeFromSpec(
    {
      direction: 'tabs',
      children: [
        { viewIds: ['a'] },
        {
          direction: 'horizontal',
          children: [{ viewIds: ['b'] }, { viewIds: ['c'] }],
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

// but a child that names nothing at all is not a tab, the same way an empty
// container is not a panel
test('a tabs node skips a child with no views anywhere under it', () => {
  const tree = treeFromSpec(
    {
      direction: 'tabs',
      children: [{ viewIds: ['a'] }, { direction: 'horizontal', children: [] }],
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

// normalize collapses a single-child branch into that child, which inherits the
// branch's size — so a one-panel "split" is just the panel, filling the space.
test('a split with one child collapses to the child', () => {
  const tree = treeFromSpec(
    { direction: 'horizontal', children: [{ viewIds: ['a'], size: 40 }] },
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
        { viewIds: ['a', 'b'] },
        { direction: 'vertical', children: [{ viewIds: ['c'] }] },
      ],
    }),
  ).toEqual(['a', 'b', 'c'])
})

test.each(['tabs', 'horizontal', 'vertical'] as const)(
  'tiling %s gives every view its own cell, in session order',
  mode => {
    expect(tileLayoutSpec(['a', 'b', 'c'], mode)).toEqual({
      direction: mode,
      children: [{ viewIds: ['a'] }, { viewIds: ['b'] }, { viewIds: ['c'] }],
    })
  },
)

test('a grid is rows of ceil(sqrt(n)) columns, filled row-major', () => {
  // 5 views -> 3 columns -> a full row and a short one. The short row is not
  // padded: its two cells share that row, which is what "tile grid" looked like
  // in the dockview version too.
  expect(tileLayoutSpec(['a', 'b', 'c', 'd', 'e'], 'grid')).toEqual({
    direction: 'vertical',
    children: [
      {
        direction: 'horizontal',
        children: [{ viewIds: ['a'] }, { viewIds: ['b'] }, { viewIds: ['c'] }],
      },
      {
        direction: 'horizontal',
        children: [{ viewIds: ['d'] }, { viewIds: ['e'] }],
      },
    ],
  })
})

test.each(['tabs', 'horizontal', 'vertical', 'grid'] as const)(
  'tiling %s with one view is the whole workspace, not a one-child split',
  mode => {
    // `normalize` would collapse a single-child branch anyway; stating the leaf
    // means the tree never has to, and an empty session states an empty leaf
    // rather than a branch with no children.
    expect(tileLayoutSpec(['only'], mode)).toEqual({ viewIds: ['only'] })
    expect(tileLayoutSpec([], mode)).toEqual({ viewIds: [] })
  },
)

test('a pending splitRight puts the named view opposite everything else', () => {
  const spec = specForPendingMove({ type: 'splitRight', viewId: 'v2' }, [
    'v1',
    'v2',
    'v3',
  ])

  expect(spec.direction).toBe('horizontal')
  expect(spec.children).toEqual([
    { viewIds: ['v1', 'v3'] },
    { viewIds: ['v2'] },
  ])
})

test('a pending move with nothing to split from just takes the space', () => {
  expect(
    specForPendingMove({ type: 'splitRight', viewId: 'v1' }, ['v1']),
  ).toEqual({ viewIds: ['v1'] })
})
