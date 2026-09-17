import { parseNewick } from '@gmod/newick'

import { rotateClusterRun } from './rotateClusterRun.ts'
import { newickLeafNames } from './rotateNewickByDomain.ts'
import { writeNewick } from './writeNewick.ts'

const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]

// What hclust hands back: the tree's leaves left to right are the `order`, and
// the order indexes the rows the matrix was built over.
const RUN = { order: [2, 3, 0, 1], tree: '((C:1,D:1):1,(A:1,B:1):1);' }

describe('a run composes with the declared order', () => {
  it('rotates the tree and re-reads the order off it', () => {
    const out = rotateClusterRun({ rows, domain: ['B'], ...RUN })
    expect(newickLeafNames(parseNewick(out.tree!))).toEqual([
      'B',
      'A',
      'C',
      'D',
    ])
    expect(out.order).toEqual([1, 0, 2, 3])
  })

  // The order and the tree have to move together or `treeDescribesRows` refuses
  // the dendrogram the run just produced.
  it('leaves the order naming the same rows as the leaves', () => {
    const { order, tree } = rotateClusterRun({ rows, domain: ['D'], ...RUN })
    expect(order.map(i => rows[i]!.name)).toEqual(
      newickLeafNames(parseNewick(tree!)),
    )
  })

  it('keeps the run untouched with no domain', () => {
    expect(rotateClusterRun({ rows, domain: [], ...RUN })).toEqual(RUN)
  })

  it('keeps the run untouched when there is no tree', () => {
    expect(rotateClusterRun({ rows, domain: ['B'], order: [1, 0] })).toEqual({
      order: [1, 0],
      tree: undefined,
    })
  })

  // A tree whose leaves are not these rows is one nothing could draw against
  // them anyway, so the run lands exactly as it would have without a domain
  // rather than with an order built from half a match.
  it('keeps the run untouched when the tree does not name the rows', () => {
    const mismatched = { order: [0, 1], tree: '(X:1,Y:1);' }
    expect(rotateClusterRun({ rows, domain: ['B'], ...mismatched })).toEqual(
      mismatched,
    )
  })
})

describe('writeNewick round-trips what the parser reads', () => {
  it('keeps incremental branch lengths', () => {
    const s = '((A:0.1,B:0.2):0.3,C:0.4);'
    expect(writeNewick(parseNewick(s))).toBe(s)
  })

  // hclust wrote the absolute merge height into the label slot through v4, and
  // saved sessions still hold one. Written back as `:1.5` it would be the first
  // `:` in the string, flipping the whole tree onto the cumulative layout.
  it('keeps an absolute merge height out of the length slot', () => {
    const s = '((A,B)1.5,C)3;'
    expect(writeNewick(parseNewick(s))).toBe(s)
  })

  it('quotes a name that would otherwise be grammar', () => {
    const written = writeNewick({
      children: [{ name: 'T cells (CD4+)' }, { name: 'B' }],
    })
    expect(written).toBe("('T cells (CD4+)',B);")
    expect(newickLeafNames(parseNewick(written))).toEqual([
      'T cells (CD4+)',
      'B',
    ])
  })
})
