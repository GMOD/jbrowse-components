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
  }).layout
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

  // the message names the position in the paste and the value at it, since on a
  // 200-line paste neither alone says where to look
  it('rejects a duplicated row', () => {
    expect(() => apply([0, 1, 1])).toThrow('entry 3 repeats row 2')
  })

  it('rejects an out-of-range row', () => {
    expect(() => apply([0, 1, 3])).toThrow(
      'entry 3 is 4, outside the range 1-3',
    )
  })

  it('counts the expanded rows in phased mode, not the samples', () => {
    expect(() => apply([2, 0, 1], 'phased')).toThrow(/expected 6 entries/)
  })

  // A phased run can start with a SAMPLE-granularity layout already in place —
  // a restored session, or a drag or a dialog submit made before the mode
  // switch. Those rows are superseded by the haplotypes and must not come back
  // — appended, they expand
  // a second time on the way to `sources` (3 samples -> 9 layout rows -> 12 drawn
  // rows against a 6-leaf tree), so the dendrogram is refused and the extra rows
  // have no cells.
  it('drops sample rows the haplotypes supersede', () => {
    const { layout: rows } = applyClusterOrder({
      sourcesBase,
      layout: sourcesBase.map(s => ({ ...s, color: 'red' })),
      order: [0, 2, 4, 1, 3, 5],
      renderingMode: 'phased',
      sampleInfo: Object.fromEntries(
        sourcesBase.map(s => [s.name, { isPhased: true, maxPloidy: 2 }]),
      ),
    })
    expect(rows).toHaveLength(6)
    expect(rows.map(s => s.name)).toEqual([
      'sampleA HP0',
      'sampleB HP0',
      'sampleC HP0',
      'sampleA HP1',
      'sampleB HP1',
      'sampleC HP1',
    ])
    // and none of the sample-granularity rows survives alongside them
    expect(rows.filter(s => s.HP === undefined)).toHaveLength(0)
  })

  // The tail exists for rows a subtree filter is hiding, and in phased mode
  // those are haplotypes. One of a pair may be hidden while its sibling
  // clusters, so keying the drop on sample alone would erase it.
  it('keeps a hidden haplotype whose sibling was clustered', () => {
    const { layout: rows } = applyClusterOrder({
      sourcesBase,
      layout: [{ name: 'sampleA HP1', sampleName: 'sampleA', HP: 1 }],
      order: [0, 1, 2],
      renderingMode: 'alleleCount',
    })
    expect(rows.map(s => s.name)).toEqual([
      'sampleA',
      'sampleB',
      'sampleC',
      'sampleA HP1',
    ])
  })
})
