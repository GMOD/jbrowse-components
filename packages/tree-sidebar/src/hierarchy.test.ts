import {
  assignBranchLengthY,
  assignDepthY,
  clusterLayout,
  descendants,
  eachAfter,
  hierarchy,
  leafNameMap,
  leaves,
  links,
  maxNodeHeight,
  renderTreeSVG,
  sort,
  sum,
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

test('sum aggregates leaf counts', () => {
  const root = hierarchy(sample(), childrenOf)
  sum(root, d => (d.children ? 0 : 1))
  expect(root.value).toBe(3)
  expect(root.children![1]!.value).toBe(2)
})

test('sort orders children in place', () => {
  const root = hierarchy(sample(), childrenOf)
  sort(root, (a, b) => (b.data.length ?? 0) - (a.data.length ?? 0))
  expect(root.children!.map(c => c.data.name)).toEqual(['B', 'A'])
  expect(root.children![0]!.children!.map(c => c.data.name)).toEqual(['D', 'C'])
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

test('assignDepthY positions by depth-to-leaf, aligning leaves at the edge', () => {
  const root = hierarchy(sample(), childrenOf)
  assignDepthY(root, 100)
  // root at 0; leaf A and leaf C both reach the right edge despite A being
  // shallower (depth 1 vs 2) — they share depth-to-leaf 0
  expect(root.y).toBe(0)
  expect(root.children![0]!.y).toBe(100)
  expect(root.children![1]!.y).toBe(50)
  expect(root.children![1]!.children![0]!.y).toBe(100)
})

// hclust dendrogram shape: internal nodes carry an absolute merge height in
// `length` (the `(A,(C,D)0.5)2` Newick form); leaves carry none.
const dendro = (): Node => ({
  name: 'root',
  length: 2,
  children: [
    { name: 'A' },
    { name: 'inner', length: 0.5, children: [{ name: 'C' }, { name: 'D' }] },
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
  // root (max height) at 0, all leaves (height 0) at the right edge, the inner
  // cluster at its merge height fraction (1 - 0.5/2)
  expect(root.y).toBe(0)
  expect(root.children![0]!.y).toBe(100)
  expect(root.children![1]!.y).toBe(75)
  expect(root.children![1]!.children![0]!.y).toBe(100)
})

test('clusterLayout uses branch-length layout when enabled', () => {
  const root = hierarchy(dendro(), childrenOf)
  clusterLayout(root, 30, 100, true)
  expect(root.y).toBe(0)
  expect(root.children![1]!.y).toBe(75)
})

test('clusterLayout falls back to cladogram when no merge heights exist', () => {
  const withLen = hierarchy(cladogram(), childrenOf)
  clusterLayout(withLen, 30, 100, true)
  const clado = hierarchy(cladogram(), childrenOf)
  clusterLayout(clado, 30, 100, false)
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

test('leafNameMap collects leaf names per subtree in linear time', () => {
  const root = hierarchy(sample(), childrenOf)
  const map = leafNameMap(root)
  expect(map.get(root)).toEqual(['A', 'C', 'D'])
  expect(map.get(root.children![1]!)).toEqual(['C', 'D'])
  expect(map.get(root.children![0]!)).toEqual(['A'])
})

test('leafNameMap skips leaves with undefined name', () => {
  const root = hierarchy<Node>(
    { children: [{ name: 'a' }, {}, { name: 'b' }] },
    childrenOf,
  )
  const map = leafNameMap(root)
  expect(map.get(root)).toEqual(['a', 'b'])
})
