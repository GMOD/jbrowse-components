import { quoteName } from '@gmod/hclust'
import { parseNewick } from '@gmod/newick'

import { clusterLayout, getLeafNames, hierarchy, leaves } from './hierarchy.ts'
import {
  buildTree,
  newickLeafNames,
  pruneNewickToLeaves,
  renameNewickLeaves,
  rotateNewickByDomain,
  treeOfLeaves,
} from './newick.ts'

import type { NewickNode } from '@gmod/newick'

// The parser's own coverage lives in @gmod/newick. What is left here is the
// pairing this package depends on and that package cannot test: @gmod/hclust
// writes the newick and @gmod/newick reads it, so the two have to agree exactly,
// and tree-sidebar relies on the default post-paren reading resolving to
// hclust's merge height rather than to a bootstrap value.

function leafNames(s: string) {
  const out: (string | undefined)[] = []
  ;(function walk(n: ReturnType<typeof parseNewick>) {
    if (n.children?.length) {
      for (const c of n.children) {
        walk(c)
      }
    } else {
      out.push(n.name)
    }
  })(parseNewick(s))
  return out
}

function roundTrip(names: string[]) {
  return leafNames(`(${names.map(quoteName).join(',')})1.2345;`)
}

test('reads hclust serialization: numeric post-paren is a merge height', () => {
  expect(parseNewick('(A,B)1.5;')).toEqual({
    length: 1.5,
    children: [{ name: 'A' }, { name: 'B' }],
  })
})

// A bootstrap/support label sits exactly where hclust puts its merge height. A
// `:` anywhere means phylo newick, so the number is support, not a length —
// reading it as a length made the cumulative layout sum support values (often
// 0-100) into the branch distances and flatten the real ones.
test('reads a post-paren numeric as a name when the tree has : lengths', () => {
  expect(parseNewick('((A:0.1,B:0.2)95,(C:0.1,D:0.1)80);')).toEqual({
    children: [
      {
        name: '95',
        children: [
          { name: 'A', length: 0.1 },
          { name: 'B', length: 0.2 },
        ],
      },
      {
        name: '80',
        children: [
          { name: 'C', length: 0.1 },
          { name: 'D', length: 0.1 },
        ],
      },
    ],
  })
})

// A quoted colon must not flip the whole tree into the phylo reading.
test('a colon inside a quoted label leaves the tree in hclust form', () => {
  expect(parseNewick("('chr1:100-200','chr2:1-50')1.5;")).toEqual({
    length: 1.5,
    children: [{ name: 'chr1:100-200' }, { name: 'chr2:1-50' }],
  })
})

test('leaves a label with no metacharacter unquoted', () => {
  expect(quoteName('GM12878')).toBe('GM12878')
  expect(quoteName('E003-H1_Cell_Line')).toBe('E003-H1_Cell_Line')
})

// A bare space is read as part of the label, so quoting it would change the
// serialized form of nearly every clustered track to fix nothing. Variants'
// phased rows are named `NA18536 HP1`, and the space is load-bearing since hover
// and subtree filtering match leaf names against row names.
test('leaves a label whose only special character is a space unquoted', () => {
  expect(quoteName('NA18536 HP1')).toBe('NA18536 HP1')
  expect(quoteName('Brain Angular Gyrus')).toBe('Brain Angular Gyrus')
  expect(roundTrip(['NA18536 HP1', 'NA18748 HP2'])).toEqual([
    'NA18536 HP1',
    'NA18748 HP2',
  ])
})

test('quotes a label carrying a metacharacter, doubling literal quotes', () => {
  expect(quoteName('cells (vHMEC)')).toBe("'cells (vHMEC)'")
  expect(quoteName('has, a comma')).toBe("'has, a comma'")
  expect(quoteName('chr1:100-200')).toBe("'chr1:100-200'")
  expect(quoteName("o'brien")).toBe("'o''brien'")
})

// Three of the Roadmap 127-epigenome names carry parentheses. Written bare, the
// parenthesis is grammar: `(BLD.CD4.NPC)` parsed back as an internal node
// wrapping a leaf of that name, so `treeDescribesRows` saw leaves that weren't
// the rows on screen and the dendrogram silently vanished behind StaleTreeHint.
test('round-trips a parenthesised label as one leaf', () => {
  const name =
    'Primary T helper naive cells from peripheral blood (BLD.CD4.NPC)'
  expect(roundTrip(['GM12878', name, 'K562'])).toEqual([
    'GM12878',
    name,
    'K562',
  ])
})

// Worse than the parenthesis case, because the tree comes back the wrong SHAPE:
// the comma splits one leaf into two, so every row below it is labeled with its
// neighbour's name rather than the tree just not drawing.
test('round-trips a label containing a comma as one leaf', () => {
  expect(roundTrip(['A', 'has, a comma', 'B'])).toEqual([
    'A',
    'has, a comma',
    'B',
  ])
})

test('round-trips a label containing a literal quote', () => {
  expect(roundTrip(['A', "o'brien", 'B'])).toEqual(['A', "o'brien", 'B'])
})

test('renameNewickLeaves hands a bare leaf undefined and keeps every length', () => {
  const seen: (string | undefined)[] = []
  const renamed = renameNewickLeaves('((a:1,:2):0.5,b:3);', name => {
    seen.push(name)
    return name === undefined ? 'blank' : name.toUpperCase()
  })
  expect(seen).toContain(undefined)
  expect(renamed).toBe('((A:1,blank:2):0.5,B:3);')
})

const FOUR = '((A,B),(C,D));'

function rotate(newick: string, domain: string[]) {
  return newickLeafNames(rotateNewickByDomain(parseNewick(newick), domain))
}

describe('a domain rotates the tree rather than reordering against it', () => {
  it('brings the listed leaf forward with its clade', () => {
    expect(rotate(FOUR, ['C'])).toEqual(['C', 'D', 'A', 'B'])
  })

  // The distinguishing case, and the one the slot descriptions quote: a flat
  // reorder would give B,C,D,A. A rotation cannot separate A from B, so A rides
  // along in second place and the dendrogram still draws.
  it('honours the order only as far as the topology allows', () => {
    expect(rotate(FOUR, ['B', 'C', 'D'])).toEqual(['B', 'A', 'C', 'D'])
  })

  it('orders leaves in different clades by their own earliest index', () => {
    expect(rotate(FOUR, ['D', 'B'])).toEqual(['D', 'C', 'B', 'A'])
  })

  it('leaves the tree alone for a name matching no leaf', () => {
    expect(rotate(FOUR, ['rn6'])).toEqual(['A', 'B', 'C', 'D'])
  })

  it('places a repeated name once, at its first index', () => {
    expect(rotate(FOUR, ['D', 'B', 'D'])).toEqual(rotate(FOUR, ['D', 'B']))
  })

  // Stability is what lets an unlisted clade come back: the rotation is derived
  // from the current domain every time, so emptying it restores file order only
  // if nothing was sorted along the way.
  it('keeps clades holding no listed leaf in the order they were written', () => {
    expect(rotate('(((A,B),(C,D)),(E,F));', ['E'])).toEqual([
      'E',
      'F',
      'A',
      'B',
      'C',
      'D',
    ])
  })

  // `parsedTree` is cached per newick string, so an in-place sort would compound
  // across domain changes. Returning the input unrotated for an empty domain
  // would pass an equality check and hide exactly that.
  it('never hands back the tree it was given', () => {
    const parsed = parseNewick(FOUR)
    const rotated = rotateNewickByDomain(parsed, [])
    expect(rotated).toEqual(parsed)
    expect(rotated).not.toBe(parsed)
    expect(rotated.children![0]).not.toBe(parsed.children![0])
  })

  it('leaves the tree it was given unmutated', () => {
    const parsed = parseNewick(FOUR)
    rotateNewickByDomain(parsed, ['D', 'B'])
    expect(newickLeafNames(parsed)).toEqual(['A', 'B', 'C', 'D'])
  })

  // The shape this package exists to draw: a single-linkage dendrogram is a
  // caterpillar whose depth is its leaf count, and the recursive form throws
  // past about 5000 tips.
  it('rotates a caterpillar deeper than the call stack', () => {
    const TIPS = 6000
    let deep: NewickNode = { name: 'l0' }
    for (let i = 1; i < TIPS; i++) {
      deep = { name: `i${i}`, length: 1, children: [deep, { name: `l${i}` }] }
    }
    const names = newickLeafNames(rotateNewickByDomain(deep, ['l0']))
    expect(names).toHaveLength(TIPS)
    expect(names[0]).toBe('l0')
  })
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
