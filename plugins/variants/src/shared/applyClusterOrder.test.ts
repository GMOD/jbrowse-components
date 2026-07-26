import { applyClusterOrder } from './applyClusterOrder.ts'

import type { ProcessedSource } from './types.ts'

const sourcesBase: ProcessedSource[] = [
  { name: 'sampleA', sampleName: 'sampleA' },
  { name: 'sampleB', sampleName: 'sampleB' },
  { name: 'sampleC', sampleName: 'sampleC' },
]

function apply(order: number[], renderingMode = 'alleleCount') {
  return applyClusterOrder({
    sourcesBase,
    layout: [],
    order,
    renderingMode,
    sampleInfo: Object.fromEntries(
      sourcesBase.map(s => [s.name, { isPhased: true, maxPloidy: 2 }]),
    ),
  })
}

describe('applyClusterOrder', () => {
  it('reorders the rows', () => {
    expect(apply([2, 0, 1]).map(s => s.name)).toEqual([
      'sampleC',
      'sampleA',
      'sampleB',
    ])
  })

  it('expands to haplotype rows in phased mode', () => {
    // ploidy 2, so the order indexes a 6-row haplotype set
    expect(apply([0, 2, 4, 1, 3, 5], 'phased').map(s => s.name)).toEqual([
      'sampleA HP0',
      'sampleB HP0',
      'sampleC HP0',
      'sampleA HP1',
      'sampleB HP1',
      'sampleC HP1',
    ])
  })

  // a hand-pasted R order is the case these guard: silently applying one would
  // drop or double rows rather than telling the user their paste was short
  it('rejects an order that does not cover every row', () => {
    expect(() => apply([0, 1])).toThrow(/expected 3 entries, got 2/)
  })

  it('rejects a duplicated row', () => {
    expect(() => apply([0, 1, 1])).toThrow(/duplicated/)
  })

  it('rejects an out-of-range row', () => {
    expect(() => apply([0, 1, 3])).toThrow(/out of range 1-3/)
  })

  it('counts the expanded rows in phased mode, not the samples', () => {
    expect(() => apply([2, 0, 1], 'phased')).toThrow(/expected 6 entries/)
  })
})
