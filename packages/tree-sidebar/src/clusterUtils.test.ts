import {
  buildClusteredLayout,
  getLeafNames,
  parseClusterTree,
  pruneNewickToLeaves,
  validateClusterOrder,
} from './clusterUtils.ts'
import { hierarchy, leaves } from './hierarchy.ts'

import type { NewickNode } from './newick.ts'

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

test('parseClusterTree returns the full tree when no filter is given', () => {
  const root = parseClusterTree('((A:1,B:1):1,(C:1,D:1):1);')
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['A', 'B', 'C', 'D'])
})

test('parseClusterTree descends into the subtree matching the filter', () => {
  const root = parseClusterTree('((A:1,B:1):1,(C:1,D:1):1);', ['C', 'D'])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['C', 'D'])
})

test('parseClusterTree filter matches nested clade', () => {
  const root = parseClusterTree('((A:1,(B:1,C:1):1):1,(D:1,E:1):1);', [
    'B',
    'C',
  ])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['B', 'C'])
})

test('parseClusterTree prunes to a scattered (non-monophyletic) leaf set', () => {
  const root = parseClusterTree('((A:1,B:1):1,(C:1,D:1):1);', ['A', 'C'])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['A', 'C'])
})

test('parseClusterTree collapses unary nodes and preserves leaf order', () => {
  // keep one leaf from each pair: the (X,Y) parents collapse to their kept leaf
  const root = parseClusterTree('((A:1,B:1):2,(C:1,D:1):2);', ['B', 'D'])
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

test('parseClusterTree returns whole tree for filter matching root leaves', () => {
  const root = parseClusterTree('((A:1,B:1):1,(C:1,D:1):1);', [
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

test('buildClusteredLayout reorders base sources and merges existing fields', () => {
  interface Source {
    name: string
    color?: string
    extra?: number
  }
  const base: Source[] = [
    { name: 'A', color: 'red' },
    { name: 'B', color: 'green' },
    { name: 'C', color: 'blue' },
  ]
  const existing: Source[] = [{ name: 'B', color: 'yellow', extra: 1 }]
  const result = buildClusteredLayout(base, existing, [2, 0, 1])
  expect(result.map(r => r.name)).toEqual(['C', 'A', 'B'])
  expect(result[2]).toMatchObject({ name: 'B', color: 'yellow', extra: 1 })
  expect(result[0]).toEqual({ name: 'C', color: 'blue' })
})

test('buildClusteredLayout throws on out-of-bounds index', () => {
  expect(() => buildClusteredLayout([{ name: 'A' }], [], [5])).toThrow(
    /out of bounds/,
  )
})

test('validateClusterOrder accepts a full permutation', () => {
  expect(() => { validateClusterOrder([2, 0, 1], 3) }).not.toThrow()
})

test('validateClusterOrder rejects out-of-range, duplicate, and wrong-length', () => {
  expect(() => { validateClusterOrder([0, 3], 3) }).toThrow(/out of range/)
  expect(() => { validateClusterOrder([0, 1, 1], 3) }).toThrow(/duplicated/)
  expect(() => { validateClusterOrder([0, 1], 3) }).toThrow(/expected 3 entries/)
})
