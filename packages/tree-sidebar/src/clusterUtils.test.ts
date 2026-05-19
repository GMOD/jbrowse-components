import {
  buildClusteredLayout,
  clusterTree,
  getLeafNames,
  parseClusterTree,
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

test('clusterTree sorts children by branch length ascending', () => {
  const root = clusterTree<NewickNode>({
    children: [
      { name: 'A', length: 3 },
      { name: 'B', length: 1 },
      { name: 'C', length: 2 },
    ],
  })
  expect(root.children!.map(c => c.data.name)).toEqual(['B', 'C', 'A'])
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

test('parseClusterTree returns full tree when filter has no exact subtree', () => {
  const root = parseClusterTree('((A:1,B:1):1,(C:1,D:1):1);', ['A', 'C'])
  expect(
    leaves(root)
      .map(l => l.data.name)
      .sort(),
  ).toEqual(['A', 'B', 'C', 'D'])
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
