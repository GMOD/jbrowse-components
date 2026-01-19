/**
 * Tests for vendored IntervalTree
 * Based on tests from @flatten-js/interval-tree
 */

import { IntervalTree } from './IntervalTree.ts'

describe('IntervalTree', () => {
  it('creates new instance', () => {
    const tree = new IntervalTree()
    expect(tree).toBeInstanceOf(IntervalTree)
  })

  it('inserts one entry with numeric tuple key', () => {
    const tree = new IntervalTree<string>()
    tree.insert([1, 2], 'val')
    expect(tree.search([1, 2])).toEqual(['val'])
  })

  it('inserts many entries', () => {
    const tree = new IntervalTree<string>()
    const intervals: [number, number][] = [
      [6, 8],
      [1, 4],
      [5, 12],
      [1, 1],
      [5, 7],
    ]
    for (let i = 0, l = intervals.length; i < l; i++) {
      tree.insert(intervals[i]!, `val${i}`)
    }
    // [1,1] intersects both [1,1] and [1,4]
    expect(tree.search([1, 1])).toContain('val3')
    expect(tree.search([1, 1])).toContain('val1')
    expect(tree.search([6, 8])).toContain('val0')
  })

  it('searches interval and returns array of values', () => {
    const tree = new IntervalTree<string>()
    const intervals: [number, number][] = [
      [6, 8],
      [1, 4],
      [5, 12],
      [1, 1],
      [5, 7],
    ]
    for (let i = 0, l = intervals.length; i < l; i++) {
      tree.insert(intervals[i]!, `val${i}`)
    }
    expect(tree.search([2, 3])).toEqual(['val1'])
  })

  it('returns empty array when search interval does not intersect any', () => {
    const tree = new IntervalTree<string>()
    const intervals: [number, number][] = [
      [6, 8],
      [1, 2],
      [7, 12],
      [1, 1],
      [5, 7],
    ]
    for (let i = 0, l = intervals.length; i < l; i++) {
      tree.insert(intervals[i]!, `val${i}`)
    }
    expect(tree.search([3, 4])).toEqual([])
  })

  it('buckets multiple values for identical keys', () => {
    const tree = new IntervalTree<number>()
    tree.insert([2, 5], 10)
    tree.insert([2, 5], 20)
    tree.insert([2, 5], 30)
    tree.insert([2, 5], 40)
    tree.insert([2, 5], 50)

    const results = tree.search([2, 5])
    expect(results).toContain(10)
    expect(results).toContain(20)
    expect(results).toContain(30)
    expect(results).toContain(40)
    expect(results).toContain(50)
    expect(results).toHaveLength(5)
  })

  it('handles storing 0 as a value', () => {
    const tree = new IntervalTree<number>()
    tree.insert([0, 0], 0)
    tree.insert([0, 0], 1)

    const results = tree.search([0, 0])
    expect(results).toEqual([0, 1])
  })

  it('stores falsy values: 0, false, NaN, null', () => {
    const tree = new IntervalTree<number | boolean | null>()
    tree.insert([0, 0], 0)
    tree.insert([0, 0], false)
    tree.insert([0, 0], NaN)
    tree.insert([0, 0], null)

    const results = tree.search([0, 0])
    expect(results).toHaveLength(4)
    expect(results).toContain(0)
    expect(results).toContain(false)
    expect(results).toContain(null)
    expect(results.some(v => Number.isNaN(v))).toBe(true)
  })

  it('stores custom objects', () => {
    interface Item {
      name: string
      value: number
    }
    const tree = new IntervalTree<Item>()
    const data: Item[] = [
      { name: 'A', value: 111 },
      { name: 'B', value: 333 },
      { name: 'C', value: 222 },
    ]

    tree.insert([2, 5], data[0]!)
    tree.insert([2, 5], data[1]!)
    tree.insert([2, 5], data[2]!)

    const results = tree.search([2, 5])
    expect(results).toContain(data[0])
    expect(results).toContain(data[1])
    expect(results).toContain(data[2])
  })

  it('normalizes reversed intervals', () => {
    const tree = new IntervalTree<string>()
    tree.insert([8, 2], 'reversed')
    tree.insert([2, 8], 'normal')

    // Both should be stored under [2, 8] and retrieved together
    const results = tree.search([3, 5])
    expect(results).toContain('reversed')
    expect(results).toContain('normal')
  })

  it('handles overlapping intervals correctly', () => {
    const tree = new IntervalTree<string>()
    tree.insert([1, 5], 'a')
    tree.insert([3, 8], 'b')
    tree.insert([6, 10], 'c')
    tree.insert([12, 15], 'd')

    expect(tree.search([4, 4])).toEqual(['a', 'b'])
    expect(tree.search([7, 7])).toEqual(['b', 'c'])
    expect(tree.search([11, 11])).toEqual([])
    expect(tree.search([1, 15])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('works with genomic-style intervals', () => {
    const tree = new IntervalTree<string>()
    tree.insert([1000, 2000], 'gene1')
    tree.insert([1500, 3000], 'gene2')
    tree.insert([5000, 6000], 'gene3')

    expect(tree.search([1700, 1800])).toEqual(['gene1', 'gene2'])
    expect(tree.search([4000, 4500])).toEqual([])
    expect(tree.search([5500, 5600])).toEqual(['gene3'])
  })

  it('returns empty array when searching empty tree', () => {
    const tree = new IntervalTree<string>()
    expect(tree.search([1, 10])).toEqual([])
  })

  it('handles adjacent non-overlapping intervals', () => {
    const tree = new IntervalTree<string>()
    tree.insert([1, 5], 'a')
    tree.insert([6, 10], 'b')

    expect(tree.search([5, 5])).toEqual(['a'])
    expect(tree.search([6, 6])).toEqual(['b'])
    // gap between them
    expect(tree.search([5.5, 5.5])).toEqual([])
  })

  it('handles intervals that touch at exactly one point', () => {
    const tree = new IntervalTree<string>()
    tree.insert([1, 5], 'a')
    tree.insert([5, 10], 'b')

    // point 5 is in both intervals
    expect(tree.search([5, 5])).toContain('a')
    expect(tree.search([5, 5])).toContain('b')
  })

  it('handles negative coordinates', () => {
    const tree = new IntervalTree<string>()
    tree.insert([-10, -5], 'neg')
    tree.insert([-3, 3], 'span')
    tree.insert([5, 10], 'pos')

    expect(tree.search([-7, -6])).toEqual(['neg'])
    expect(tree.search([0, 0])).toEqual(['span'])
    expect(tree.search([-20, 20])).toEqual(['neg', 'span', 'pos'])
  })

  it('handles nested/containing intervals', () => {
    const tree = new IntervalTree<string>()
    tree.insert([1, 100], 'outer')
    tree.insert([25, 75], 'middle')
    tree.insert([40, 60], 'inner')

    expect(tree.search([50, 50])).toContain('outer')
    expect(tree.search([50, 50])).toContain('middle')
    expect(tree.search([50, 50])).toContain('inner')
    expect(tree.search([10, 20])).toEqual(['outer'])
  })

  it('handles large coordinates', () => {
    const tree = new IntervalTree<string>()
    tree.insert([100000000, 100001000], 'gene1')
    tree.insert([200000000, 200001000], 'gene2')

    expect(tree.search([100000500, 100000600])).toEqual(['gene1'])
    expect(tree.search([150000000, 150000000])).toEqual([])
  })

  it('handles many intervals (stress test)', () => {
    const tree = new IntervalTree<number>()
    // insert 1000 intervals
    for (let i = 0; i < 1000; i++) {
      tree.insert([i * 10, i * 10 + 5], i)
    }

    expect(tree.search([500, 505])).toEqual([50])
    expect(tree.search([0, 10000])).toHaveLength(1000)
  })

  it('handles single interval tree', () => {
    const tree = new IntervalTree<string>()
    tree.insert([5, 10], 'only')

    expect(tree.search([1, 4])).toEqual([])
    expect(tree.search([7, 8])).toEqual(['only'])
    expect(tree.search([11, 15])).toEqual([])
  })
})
