import { applyClusterOrder } from './applyClusterOrder.ts'

const rows = [{ name: 'sampleA' }, { name: 'sampleB' }, { name: 'sampleC' }]

function apply(order: number[], clustered = rows) {
  return applyClusterOrder({
    rows: clustered,
    arranged: rows,
    order,
  }).order.map(s => s.name)
}

describe('applyClusterOrder', () => {
  it('reorders the rows', () => {
    expect(apply([2, 0, 1])).toEqual(['sampleC', 'sampleA', 'sampleB'])
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

  // The rows the focus hides were not clustered and are not in the tree, but
  // the order is the record of where every row sits: dropped, clearing the
  // focus would push them to the end.
  it('appends the rows the focus hides, in the order they had', () => {
    expect(
      applyClusterOrder({
        rows: [{ name: 'sampleC' }, { name: 'sampleA' }],
        arranged: [
          { name: 'sampleB' },
          { name: 'sampleC' },
          { name: 'sampleA' },
        ],
        order: [1, 0],
      }).order.map(s => s.name),
    ).toEqual(['sampleA', 'sampleC', 'sampleB'])
  })

  // In phased mode the rows are haplotypes, and one of a pair may be hidden
  // while its sibling clusters.
  it('keeps a hidden haplotype whose sibling was clustered', () => {
    const haplotypes = ['sampleA HP0', 'sampleA HP1', 'sampleB HP0'].map(
      name => ({ name }),
    )
    expect(
      applyClusterOrder({
        rows: [haplotypes[2]!, haplotypes[0]!],
        arranged: haplotypes,
        order: [1, 0],
      }).order.map(s => s.name),
    ).toEqual(['sampleA HP0', 'sampleB HP0', 'sampleA HP1'])
  })
})
