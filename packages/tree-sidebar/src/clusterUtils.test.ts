import {
  buildTree,
  clusteredCladeLayout,
  computeClusterHierarchy,
  getLeafNames,
  keptRows,
  pruneNewickToLeaves,
  subtreeCoversEveryRow,
  treeDescribesRows,
  treeOfLeaves,
} from './clusterUtils.ts'
import { clusterLayout, hierarchy, leaves } from './hierarchy.ts'

import type { NewickNode } from '@gmod/newick'

test('getLeafNames walks the subtree', () => {
  const root = hierarchy<NewickNode>(
    {
      children: [{ name: 'A' }, { children: [{ name: 'B' }, { name: 'C' }] }],
    },
    d => d.children,
  )
  expect(getLeafNames(root).sort()).toEqual(['A', 'B', 'C'])
})

test('getLeafNames skips unnamed leaves', () => {
  const root = hierarchy<NewickNode>(
    { children: [{ name: 'A' }, {}, { name: 'B' }] },
    d => d.children,
  )
  expect(getLeafNames(root).sort()).toEqual(['A', 'B'])
})

test('buildTree returns the full tree', () => {
  const root = buildTree('((A:1,B:1):1,(C:1,D:1):1);')
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['A', 'B', 'C', 'D'])
})

test('treeOfLeaves descends into the subtree matching the filter', () => {
  const root = treeOfLeaves(buildTree('((A:1,B:1):1,(C:1,D:1):1);'), ['C', 'D'])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['C', 'D'])
})

test('treeOfLeaves filter matches nested clade', () => {
  const root = treeOfLeaves(buildTree('((A:1,(B:1,C:1):1):1,(D:1,E:1):1);'), [
    'B',
    'C',
  ])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['B', 'C'])
})

test('treeOfLeaves prunes to a scattered (non-monophyletic) leaf set', () => {
  const root = treeOfLeaves(buildTree('((A:1,B:1):1,(C:1,D:1):1);'), ['A', 'C'])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['A', 'C'])
})

test('treeOfLeaves collapses unary nodes and preserves leaf order', () => {
  // keep one leaf from each pair: the (X,Y) parents collapse to their kept leaf
  const root = treeOfLeaves(buildTree('((A:1,B:1):2,(C:1,D:1):2);'), ['B', 'D'])
  expect(leaves(root).map(l => l.data.name)).toEqual(['B', 'D'])
  // both kept leaves sit directly under the root after the unary collapse
  expect(root.children!.map(c => c.data.name)).toEqual(['B', 'D'])
})

test('pruneNewickToLeaves sums branch length when collapsing a unary node', () => {
  // root -> (clade -> (B,C)); keep only C: clade collapses, C's branch absorbs it
  const pruned = pruneNewickToLeaves(
    {
      children: [
        { name: 'A', length: 1 },
        {
          length: 5,
          children: [
            { name: 'B', length: 1 },
            { name: 'C', length: 2 },
          ],
        },
      ],
    },
    new Set(['C']),
  )
  // root now has a single kept leaf C; its length is 2 (own) + 5 (collapsed clade)
  expect(pruned?.name).toBe('C')
  expect(pruned?.length).toBe(7)
})

test('treeOfLeaves returns whole tree for filter matching root leaves', () => {
  const root = treeOfLeaves(buildTree('((A:1,B:1):1,(C:1,D:1):1);'), [
    'A',
    'B',
    'C',
    'D',
  ])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['A', 'B', 'C', 'D'])
})

test('clusteredCladeLayout reorders the rows it indexes', () => {
  const base = [
    { name: 'A', color: 'red' },
    { name: 'B', color: 'green' },
    { name: 'C', color: 'blue' },
  ]
  const result = clusteredCladeLayout({
    rows: base,
    editableSources: base,
    order: [2, 0, 1],
  })
  expect(result.map(r => r.name)).toEqual(['C', 'A', 'B'])
  expect(result[0]).toBe(base[2])
})

// The four displays' one commit path. A run under a focus clusters the clade, so
// the order covers only those rows -- the rest are the user's record of where
// they sit and what they were named, and dropping them would erase that the
// moment the focus cleared.
test('clusteredCladeLayout re-appends the rows the filter is hiding', () => {
  const editableSources = [
    { name: 'A' },
    { name: 'B', color: 'yellow' },
    { name: 'C' },
    { name: 'D' },
  ]
  const result = clusteredCladeLayout({
    rows: [{ name: 'A' }, { name: 'C' }],
    editableSources,
    order: [1, 0],
  })

  expect(result.map(r => r.name)).toEqual(['C', 'A', 'B', 'D'])
  expect(result[2]).toEqual({ name: 'B', color: 'yellow' })
})

test('clusteredCladeLayout rejects an order that misses a clustered row', () => {
  expect(() =>
    clusteredCladeLayout({
      rows: abc,
      editableSources: abc,
      order: [0, 1],
    }),
  ).toThrow(/expected 3 entries/)
})

const abc = [{ name: 'A' }, { name: 'B' }, { name: 'C' }]

function layoutAbc(order: number[], matrixRowNames?: string[]) {
  clusteredCladeLayout({
    rows: abc,
    editableSources: abc,
    order,
    matrixRowNames,
  })
}

test('clusteredCladeLayout accepts a full permutation', () => {
  expect(() => {
    layoutAbc([2, 0, 1])
  }).not.toThrow()
})

// The message is the only feedback on a long paste, so it names the position in
// the paste AND the offending value. "entry 2" used to be the value, printed
// where a position reads.
test('clusteredCladeLayout rejects out-of-range, duplicate, and wrong-length', () => {
  expect(() => {
    layoutAbc([0, 3])
  }).toThrow('entry 2 is 4, outside the range 1-3')
  expect(() => {
    layoutAbc([0, 1, 1])
  }).toThrow('entry 3 repeats row 2')
  expect(() => {
    layoutAbc([0, 1])
  }).toThrow(/expected 3 entries/)
})

// `parseClusterOrder` is a bare `+`, so a stray word in the paste reaches here
// as NaN. It used to print as "entry NaN is out of range 1-3", naming neither
// the position nor the value.
test('clusteredCladeLayout names a non-numeric paste line by position', () => {
  expect(() => {
    layoutAbc([0, Number.NaN, 2])
  }).toThrow('entry 2 is not a whole number')
})

test('clusteredCladeLayout accepts an order over the rows the matrix held', () => {
  expect(() => {
    layoutAbc([2, 0, 1], ['A', 'B', 'C'])
  }).not.toThrow()
})

// The one a cardinality check cannot see: the row set moved while the user was
// in R, keeping its count, so every rank lands on a row that never entered the
// matrix and the dendrogram still draws.
test('clusteredCladeLayout rejects an order whose rows were swapped out', () => {
  expect(() => {
    layoutAbc([2, 0, 1], ['A', 'D', 'C'])
  }).toThrow('row 2 was "D" and is now "B"')
})

test('clusteredCladeLayout reports a row count that moved before the entries', () => {
  // the count check would have said "expected 3 entries, got 2", which names
  // the paste rather than the rows that changed under it
  expect(() => {
    layoutAbc([1, 0], ['A', 'B'])
  }).toThrow('the matrix had 2 rows and there are now 3')
})

// hclust's `length` is an absolute merge height, so a collapsing unary node
// must drop it rather than add it: summing invents a depth, and a bare hclust
// leaf that gains a `length` flips the tree onto the cumulative phylogram
// layout, stranding leaves mid-tree instead of flush against their row labels.
test('pruneNewickToLeaves drops merge heights when collapsing a unary node', () => {
  const root = treeOfLeaves(buildTree('((A,B)4,(C,D)1)5;'), ['A', 'C'])
  expect(root.data).toEqual({
    length: 5,
    children: [{ name: 'A' }, { name: 'C' }],
  })
  const laid = clusterLayout(root, 100, 80, true)
  // both leaves stay flush at the leaf edge, as they were before the filter
  expect(leaves(laid).map(l => l.y)).toEqual([80, 80])
})

test('keptRows returns the input array itself when unfiltered', () => {
  const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]
  expect(keptRows(rows, undefined)).toBe(rows)
  expect(keptRows(rows, [])).toBe(rows)
})

test('keptRows keeps row order, not filter order', () => {
  const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]
  expect(keptRows(rows, ['kid', 'mom'])).toEqual([
    { name: 'mom' },
    { name: 'kid' },
  ])
})

test('keptRows ignores filter names no row has', () => {
  const rows = [{ name: 'mom' }, { name: 'dad' }]
  expect(keptRows(rows, ['dad', 'ghost'])).toEqual([{ name: 'dad' }])
})

// The tree is positioned by spacing its own leaves evenly across the row axis
// (leaf i lands on row i), so a tree that no longer names the rows on screen
// draws the whole dendrogram against the wrong ones. `computeClusterHierarchy`
// is where every display positions its tree, so it is where that is caught —
// including for the ways rows move with no `setRowOrder` call to hook.
// The root always contains every row, and clicking it is a natural "show me
// everything" gesture — which is the click that must not apply a filter. It
// would leave the rows where they are while making "Show all rows"
// appear as though something had changed, and on MAF, where `subtreeFilter` is
// an `rpcProps()` cache key, drop every loaded region to re-download identical
// rows.
describe('subtreeCoversEveryRow', () => {
  it('is true for a node holding as many leaves as there are rows', () => {
    expect(subtreeCoversEveryRow(['a', 'b', 'c'], 3)).toBe(true)
  })

  it('is false for a proper subtree, which is the case worth offering', () => {
    expect(subtreeCoversEveryRow(['a', 'b'], 3)).toBe(false)
  })

  // A count comparison is sound only under `treeDescribesRows`, which is what
  // positions the tree in the first place: its leaves ARE the drawn rows, so
  // equal counts means the same set. Pinned together so the two do not drift.
  it('agrees with the invariant it leans on', () => {
    const rows = [{ name: 'a' }, { name: 'b' }]
    const root = buildTree('(a:1,b:1):0;')
    expect(treeDescribesRows(root, rows)).toBe(true)
    expect(subtreeCoversEveryRow(getLeafNames(root), rows.length)).toBe(true)
  })
})

describe('treeDescribesRows', () => {
  const root = buildTree('((a,b),c);')

  test('true when the leaves are the rows, in order', () => {
    expect(
      treeDescribesRows(root, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]),
    ).toBe(true)
  })

  test('false when the rows are reordered (same membership)', () => {
    expect(
      treeDescribesRows(root, [{ name: 'b' }, { name: 'a' }, { name: 'c' }]),
    ).toBe(false)
  })

  test('false when a row is added', () => {
    expect(
      treeDescribesRows(root, [
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
        { name: 'd' },
      ]),
    ).toBe(false)
  })

  test('false when a row is dropped', () => {
    expect(treeDescribesRows(root, [{ name: 'a' }, { name: 'b' }])).toBe(false)
  })
})

describe('computeClusterHierarchy', () => {
  const root = buildTree('((a,b),c);')
  const rows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]

  test('positions the tree when it describes the rows', () => {
    const laid = computeClusterHierarchy(root, rows, 90, 80, false)
    expect(leaves(laid!).map(l => l.data.name)).toEqual(['a', 'b', 'c'])
  })

  test('declines a tree whose leaves are not the rows on screen', () => {
    // e.g. multi-row features' `rows.groups` regrouping `sources` downstream of
    // `layout`, or a discovered row set growing as regions load
    expect(
      computeClusterHierarchy(
        root,
        [rows[2]!, rows[0]!, rows[1]!],
        90,
        80,
        false,
      ),
    ).toBeUndefined()
    expect(
      computeClusterHierarchy(root, [...rows, { name: 'd' }], 90, 80, false),
    ).toBeUndefined()
  })

  // The contract on the third argument, made executable: given the rows' full
  // stacked extent, leaf *i* has to land on the center of row *i*, because that
  // is where everything drawn beside the tree puts it (the hover highlight in
  // `treeDrawingAutorun`, `SvgRowLabels`, each display's own painting) — all of
  // them off `i × effectiveRowHeight`, none of them reconciling by name. A
  // scrolling display's viewport height still produces a dendrogram, so
  // nothing downstream would catch it.
  test('lands leaf i on the center of row i', () => {
    const rowHeight = 30
    const laid = computeClusterHierarchy(
      root,
      rows,
      rows.length * rowHeight,
      80,
      false,
    )
    expect(leaves(laid!).map(l => l.x)).toEqual([15, 45, 75])
  })

  test('undefined with no tree and with no rows', () => {
    expect(
      computeClusterHierarchy(undefined, rows, 90, 80, false),
    ).toBeUndefined()
    expect(computeClusterHierarchy(root, [], 90, 80, false)).toBeUndefined()
    expect(
      computeClusterHierarchy(root, undefined, 90, 80, false),
    ).toBeUndefined()
  })
})

// Both halves of treeOfLeaves used to recurse once per node, so focusing a
// clade on a single-linkage dendrogram threw RangeError past about 5000 tips —
// and `subtreeFilter` is persisted, so a shared session carrying one threw on
// load and never recovered. The rest of this package went iterative for exactly
// this shape (hierarchy.test.ts lays out a 50,000-tip caterpillar); these two
// were missed.
describe('a caterpillar deeper than the call stack', () => {
  const DEPTH = 20_000
  function caterpillar() {
    let deep: NewickNode = { name: 'l0' }
    for (let i = 1; i < DEPTH; i++) {
      deep = { name: `i${i}`, length: 1, children: [deep, { name: `l${i}` }] }
    }
    return deep
  }

  test('focusing a monophyletic clade descends into it', () => {
    const root = hierarchy<NewickNode>(caterpillar(), d => d.children)
    // every leaf below the second-deepest internal node: l0 and l1
    const filtered = treeOfLeaves(root, ['l0', 'l1'])
    expect(getLeafNames(filtered)).toEqual(['l0', 'l1'])
  })

  test('a scattered leaf set prunes to those leaves', () => {
    const root = hierarchy<NewickNode>(caterpillar(), d => d.children)
    const keep = ['l0', 'l500', 'l9000', `l${DEPTH - 1}`]
    const filtered = treeOfLeaves(root, keep)
    expect(getLeafNames(filtered).sort()).toEqual([...keep].sort())
  })

  test('a filter naming nothing present leaves the tree alone', () => {
    const root = hierarchy<NewickNode>(caterpillar(), d => d.children)
    expect(getLeafNames(treeOfLeaves(root, ['nope']))).toHaveLength(DEPTH)
  })
})
