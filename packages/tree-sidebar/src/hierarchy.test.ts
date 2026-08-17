import {
  assignBranchLengthY,
  assignDepthY,
  clusterLayout,
  descendants,
  eachAfter,
  hasIncrementalBranchLengths,
  hierarchy,
  leaves,
  links,
  maxNodeHeight,
  renderTreeSVG,
} from './hierarchy.ts'

interface Node {
  name?: string
  length?: number
  children?: Node[]
}

const sample = (): Node => ({
  name: 'root',
  children: [
    { name: 'A', length: 1 },
    {
      name: 'B',
      length: 2,
      children: [
        { name: 'C', length: 0.5 },
        { name: 'D', length: 1.5 },
      ],
    },
  ],
})

const childrenOf = (d: Node) => d.children

test('hierarchy wraps data with parent/depth/height', () => {
  const root = hierarchy(sample(), childrenOf)
  expect(root.depth).toBe(0)
  expect(root.height).toBe(2)
  expect(root.parent).toBeNull()
  expect(root.children).toHaveLength(2)
  const a = root.children![0]!
  expect(a.depth).toBe(1)
  expect(a.height).toBe(0)
  expect(a.parent).toBe(root)
  const b = root.children![1]!
  expect(b.height).toBe(1)
  expect(b.children![0]!.depth).toBe(2)
})

test('hierarchy handles leaf-only input', () => {
  const root = hierarchy<Node>({ name: 'solo' }, childrenOf)
  expect(root.height).toBe(0)
  expect(root.children).toBeNull()
})

test('leaves returns only terminal nodes', () => {
  const root = hierarchy(sample(), childrenOf)
  expect(leaves(root).map(l => l.data.name)).toEqual(['A', 'C', 'D'])
})

test('descendants is pre-order', () => {
  const root = hierarchy(sample(), childrenOf)
  expect(descendants(root).map(n => n.data.name)).toEqual([
    'root',
    'A',
    'B',
    'C',
    'D',
  ])
})

test('eachAfter is post-order', () => {
  const root = hierarchy(sample(), childrenOf)
  const visited: (string | undefined)[] = []
  eachAfter(root, n => {
    visited.push(n.data.name)
  })
  expect(visited).toEqual(['A', 'C', 'D', 'B', 'root'])
})

test('links pairs parent→child', () => {
  const root = hierarchy(sample(), childrenOf)
  const pairs = links(root).map(l => [l.source.data.name, l.target.data.name])
  expect(pairs).toEqual([
    ['root', 'A'],
    ['root', 'B'],
    ['B', 'C'],
    ['B', 'D'],
  ])
})

test('clusterLayout positions leaves uniformly and parents at child mean', () => {
  const root = hierarchy(sample(), childrenOf)
  const laid = clusterLayout(root, 30, 10)
  const [a, c, d] = leaves(laid)
  expect(a!.x).toBe(5)
  expect(c!.x).toBe(15)
  expect(d!.x).toBe(25)
  expect(laid.children![1]!.x).toBe(20)
  // leaf A aligns at the right edge (depth-to-leaf 0), not midway
  expect(laid.children![0]!.y).toBe(10)
  expect(laid.children![1]!.children![0]!.y).toBe(10)
})

test('clusterLayout handles a single leaf without dividing by zero', () => {
  const root = hierarchy<Node>({ name: 'only' }, childrenOf)
  const laid = clusterLayout(root, 20, 10)
  expect(laid.x).toBe(10)
  expect(laid.y).toBe(10)
})

// Regression: clusterLayout must lay out a FRESH copy, not mutate its input.
// Callers pass a memoized tree, so mutating in place both corrupts that cache
// and returns a stable reference — which left the hit-test spatial index frozen
// at the row height it was first built at, so hovering missed after a resize.
test('clusterLayout returns a fresh tree and leaves its input unmutated', () => {
  const root = hierarchy(sample(), childrenOf)
  const laid1 = clusterLayout(root, 30, 10)
  const laid2 = clusterLayout(root, 60, 10)
  expect(root.x).toBeUndefined()
  expect(root.y).toBeUndefined()
  expect(laid2).not.toBe(laid1)
  expect(laid2).not.toBe(root)
})

test('assignDepthY positions by depth-to-leaf, aligning leaves at the edge', () => {
  const root = hierarchy(sample(), childrenOf)
  assignDepthY(root, 100)
  // root sits at the left inset (TREE_LEFT_PAD) so its stroke isn't clipped;
  // leaf A and leaf C both reach the right edge despite A being shallower
  // (depth 1 vs 2) — they share depth-to-leaf 0
  expect(root.y).toBe(2)
  expect(root.children![0]!.y).toBe(100)
  expect(root.children![1]!.y).toBe(51)
  expect(root.children![1]!.children![0]!.y).toBe(100)
})

// absolute-merge-height dendrogram, as hclust wrote through v4 and as saved
// sessions still hold: internal nodes carry the height in `length` (the
// `(A,(C,D)0.5)2` Newick form), leaves carry nothing.
const dendro = (): Node => ({
  name: 'root',
  length: 2,
  children: [
    { name: 'A' },
    { name: 'inner', length: 0.5, children: [{ name: 'C' }, { name: 'D' }] },
  ],
})

// the same dendrogram as hclust v5 writes it, `((A:2,(C:0.5,D:0.5):1.5))`: each
// length is the drop from a node's height to its child's, so the root carries
// none and every root-to-leaf path sums to the root's height of 2.
const dendroWithBranchLengths = (): Node => ({
  name: 'root',
  children: [
    { name: 'A', length: 2 },
    {
      name: 'inner',
      length: 1.5,
      children: [
        { name: 'C', length: 0.5 },
        { name: 'D', length: 0.5 },
      ],
    },
  ],
})

// topology-only tree: no heights anywhere
const cladogram = (): Node => ({
  name: 'root',
  children: [{ name: 'A' }, { children: [{ name: 'C' }, { name: 'D' }] }],
})

test('maxNodeHeight returns the largest merge height', () => {
  expect(maxNodeHeight(hierarchy(dendro(), childrenOf))).toBe(2)
  expect(maxNodeHeight(hierarchy(cladogram(), childrenOf))).toBe(0)
})

test('assignBranchLengthY positions nodes by absolute merge height', () => {
  const root = hierarchy(dendro(), childrenOf)
  assignBranchLengthY(root, 100)
  // root (max height) at the left inset, all leaves (height 0) at the right
  // edge, the inner cluster at its merge height fraction (1 - 0.5/2)
  expect(root.y).toBe(2)
  expect(root.children![0]!.y).toBe(100)
  expect(root.children![1]!.y).toBe(75.5)
  expect(root.children![1]!.children![0]!.y).toBe(100)
})

test('both encodings of one dendrogram lay out identically', () => {
  // hclust v5 writes `:` lengths where v4 wrote merge heights, so this is the
  // guarantee that a re-clustered tree draws exactly like the saved session it
  // replaces. It holds because every leaf of a dendrogram sits at the same
  // distance from the root, which makes cumulative depth and height-below-root
  // the same measurement.
  const legacy = hierarchy(dendro(), childrenOf)
  const current = hierarchy(dendroWithBranchLengths(), childrenOf)
  assignBranchLengthY(legacy, 100)
  assignBranchLengthY(current, 100)

  expect(hasIncrementalBranchLengths(legacy)).toBe(false)
  expect(hasIncrementalBranchLengths(current)).toBe(true)
  expect(descendants(current).map(n => n.y)).toEqual(
    descendants(legacy).map(n => n.y),
  )
  expect(current.y).toBe(2)
  expect(current.children![1]!.y).toBe(75.5)
})

test('clusterLayout uses branch-length layout when enabled', () => {
  const laid = clusterLayout(hierarchy(dendro(), childrenOf), 30, 100, true)
  expect(laid.y).toBe(2)
  expect(laid.children![1]!.y).toBe(75.5)
})

// real phylo shape (UCSC multiz style): `:` lengths on every branch, leaves
// included, and incremental rather than absolute
const phylo = (): Node => ({
  children: [
    {
      length: 0.0057,
      children: [
        { name: 'hg38', length: 0.0067 },
        { name: 'panTro4', length: 0.0067 },
      ],
    },
    {
      length: 0.05,
      children: [
        { name: 'mm10', length: 0.3 },
        { name: 'rn5', length: 0.3 },
      ],
    },
  ],
})

test('hasIncrementalBranchLengths distinguishes phylo from hclust newick', () => {
  // hclust `toNewick` writes leaves bare, so a leaf length means a `:` token
  expect(hasIncrementalBranchLengths(hierarchy(dendro(), childrenOf))).toBe(
    false,
  )
  expect(hasIncrementalBranchLengths(hierarchy(cladogram(), childrenOf))).toBe(
    false,
  )
  expect(hasIncrementalBranchLengths(hierarchy(phylo(), childrenOf))).toBe(true)
})

test('assignBranchLengthY positions phylo nodes by cumulative root distance', () => {
  const root = hierarchy(phylo(), childrenOf)
  assignBranchLengthY(root, 100)
  // fractions match ape::node.depth.edgelength / max: the deepest root->leaf
  // path is mm10/rn5 at 0.05+0.3=0.35, so hg38 sits at (0.0057+0.0067)/0.35
  const frac = (n: { y?: number }) => ((n.y ?? 0) - 2) / 98
  expect(root.y).toBe(2) // root at the left inset, not the leaf edge
  expect(frac(root.children![0]!)).toBeCloseTo(0.016, 3)
  expect(frac(root.children![0]!.children![0]!)).toBeCloseTo(0.035, 3)
  expect(frac(root.children![1]!)).toBeCloseTo(0.143, 3)
  // longest branches reach the right edge; the near leaves stay left of them
  expect(frac(root.children![1]!.children![0]!)).toBeCloseTo(1, 3)
})

test('clusterLayout falls back to cladogram when no merge heights exist', () => {
  const withLen = clusterLayout(
    hierarchy(cladogram(), childrenOf),
    30,
    100,
    true,
  )
  const clado = clusterLayout(
    hierarchy(cladogram(), childrenOf),
    30,
    100,
    false,
  )
  expect(descendants(withLen).map(n => n.y)).toEqual(
    descendants(clado).map(n => n.y),
  )
})

test('renderTreeSVG emits orthogonal connector path', () => {
  const root = hierarchy(sample(), childrenOf)
  const laid = clusterLayout(root, 30, 10)
  const d = renderTreeSVG(laid)
  for (const link of links(laid)) {
    const { source, target } = link
    expect(d).toContain(
      `M${source.y},${source.x}L${source.y},${target.x}M${source.y},${target.x}L${target.y},${target.x}`,
    )
  }
})

// Single-linkage clustering chains, so a dendrogram can be a caterpillar whose
// depth is its leaf count. The layout used to recurse and threw
// "RangeError: Maximum call stack size exceeded" somewhere past 5000 tips.
test('lays out a caterpillar dendrogram far deeper than the call stack', () => {
  let deep: Node = { name: 'l0' }
  for (let i = 1; i < 50_000; i++) {
    deep = { name: `i${i}`, length: i, children: [deep, { name: `l${i}` }] }
  }
  const laid = clusterLayout(hierarchy(deep, childrenOf), 100, 100, true)
  expect(leaves(laid)).toHaveLength(50_000)
  expect(descendants(laid)).toHaveLength(99_999)
})
