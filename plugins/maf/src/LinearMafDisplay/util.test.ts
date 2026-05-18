import {
  computeNodeDescendantNames,
  generateTooltipContent,
  getMsaHighlights,
} from './util.ts'

import type { HierarchyNode } from '@jbrowse/tree-sidebar'

describe('getMsaHighlights', () => {
  test('returns empty when no MSA views are connected', () => {
    expect(getMsaHighlights([], 'view1')).toEqual([])
  })

  test('filters by connectedViewId', () => {
    const views = [
      {
        type: 'MsaView',
        connectedViewId: 'view1',
        connectedHighlights: [{ refName: 'chr1', start: 0, end: 10 }],
      },
      {
        type: 'MsaView',
        connectedViewId: 'view2',
        connectedHighlights: [{ refName: 'chr2', start: 0, end: 10 }],
      },
    ]
    expect(getMsaHighlights(views, 'view1')).toEqual([
      { refName: 'chr1', start: 0, end: 10 },
    ])
  })

  test('ignores non-MsaView entries', () => {
    const views = [
      {
        type: 'LinearGenomeView',
        connectedViewId: 'view1',
        connectedHighlights: [{ refName: 'chr1', start: 0, end: 10 }],
      },
    ]
    expect(getMsaHighlights(views, 'view1')).toEqual([])
  })

  test('handles MsaView with no highlights array', () => {
    const views = [{ type: 'MsaView', connectedViewId: 'view1' }]
    expect(getMsaHighlights(views, 'view1')).toEqual([])
  })

  test('handles null/undefined entries safely', () => {
    expect(getMsaHighlights([null, undefined, 'string'], 'view1')).toEqual([])
  })
})

describe('generateTooltipContent', () => {
  test('drag range shows start, end, and length', () => {
    const result = generateTooltipContent(
      undefined,
      { refName: 'chr1', coord: 100 },
      { refName: 'chr1', coord: 200 },
    )
    expect(result).toContain('Start: chr1:100')
    expect(result).toContain('End: chr1:200')
    expect(result).toContain('Length:')
  })

  test('single position with hover info shows alt sample', () => {
    const result = generateTooltipContent(
      {
        sampleId: 's1',
        sampleLabel: 'Sample1',
        pos: 150,
        base: 'A',
        chr: 'chr1',
      },
      undefined,
      { refName: 'chr1', coord: 150 },
    )
    expect(result).toContain('Ref: chr1:150')
    expect(result).toContain('Alt Sample1: chr1:150 (A)')
  })

  test('insertion label appears for isInsertion', () => {
    const result = generateTooltipContent(
      {
        sampleId: 's1',
        sampleLabel: 'Sample1',
        pos: 150,
        base: 'ACGT',
        chr: 'chr1',
        isInsertion: true,
      },
      undefined,
      { refName: 'chr1', coord: 150 },
    )
    expect(result).toContain('4bp')
    expect(result).toContain('Insertion')
  })

  test('long base sequence is truncated', () => {
    const longBase = 'A'.repeat(30)
    const result = generateTooltipContent(
      {
        sampleId: 's1',
        sampleLabel: 'Sample1',
        pos: 150,
        base: longBase,
        chr: 'chr1',
      },
      undefined,
      { refName: 'chr1', coord: 150 },
    )
    expect(result).toContain('...')
  })
})

describe('computeNodeDescendantNames', () => {
  test('leaf node returns its own name', () => {
    const leaf: HierarchyNode<{ name: string }> = {
      data: { name: 'hg38' },
    } as HierarchyNode<{ name: string }>
    const map = computeNodeDescendantNames(leaf)
    expect(map.get(leaf)).toEqual(['hg38'])
  })

  test('internal node returns all descendant leaf names', () => {
    const leafA = { data: { name: 'a' } } as HierarchyNode<{ name: string }>
    const leafB = { data: { name: 'b' } } as HierarchyNode<{ name: string }>
    const leafC = { data: { name: 'c' } } as HierarchyNode<{ name: string }>
    const inner = {
      data: {},
      children: [leafB, leafC],
    } as unknown as HierarchyNode<{ name: string }>
    const root = {
      data: {},
      children: [leafA, inner],
    } as unknown as HierarchyNode<{ name: string }>

    const map = computeNodeDescendantNames(root)
    expect(map.get(root)).toEqual(['a', 'b', 'c'])
    expect(map.get(inner)).toEqual(['b', 'c'])
    expect(map.get(leafA)).toEqual(['a'])
  })

  test('leaf with undefined name returns empty array', () => {
    const leaf = { data: {} } as HierarchyNode<{ name?: string }>
    const map = computeNodeDescendantNames(leaf)
    expect(map.get(leaf)).toEqual([])
  })
})
