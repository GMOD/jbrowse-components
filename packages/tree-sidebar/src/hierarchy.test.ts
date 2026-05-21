import {
  assignDepthY,
  clusterLayout,
  descendants,
  eachAfter,
  hierarchy,
  leafNameMap,
  leaves,
  links,
  maxLength,
  renderTreeSVG,
  setBrLength,
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
  expect(laid.children![0]!.y).toBe(5)
  expect(laid.children![1]!.children![0]!.y).toBe(10)
})

test('clusterLayout handles a single leaf without dividing by zero', () => {
  const root = hierarchy<Node>({ name: 'only' }, childrenOf)
  const laid = clusterLayout(root, 20, 10)
  expect(laid.x).toBe(10)
  expect(laid.y).toBe(10)
})

test('assignDepthY scales by root.height', () => {
  const root = hierarchy(sample(), childrenOf)
  assignDepthY(root, 100)
  expect(root.y).toBe(0)
  expect(root.children![0]!.y).toBe(50)
  expect(root.children![1]!.children![0]!.y).toBe(100)
})

test('maxLength sums root-to-leaf branch lengths', () => {
  const root = hierarchy(sample(), childrenOf)
  expect(maxLength(root)).toBe(3.5)
})

test('setBrLength assigns scaled cumulative branch length', () => {
  const root = hierarchy(sample(), childrenOf)
  root.data.length = 0
  setBrLength(root, 0, 10)
  expect(root.len).toBe(0)
  expect(root.children![0]!.len).toBe(10)
  expect(root.children![1]!.children![0]!.len).toBe(25)
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
