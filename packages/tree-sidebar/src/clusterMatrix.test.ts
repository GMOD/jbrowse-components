import { toNewick } from '@gmod/hclust'
import { parseNewick } from '@gmod/newick'

import { clusterMatrix } from './clusterMatrix.ts'

import type { NewickNode } from '@gmod/newick'

function leafNames(node: NewickNode): string[] {
  return node.children?.length ? node.children.flatMap(leafNames) : [node.name!]
}

// The two halves of the format have to agree, and only an end-to-end assertion
// says so: hclust's `toNewick` and our `parseNewick` can each be self-
// consistently wrong. This is the pairing that broke — the Roadmap
// 127-epigenome track's dendrogram vanished behind StaleTreeHint because three
// row names carry parentheses and the serialized tree parsed back naming leaves
// that were not the rows on screen.
test('serializes row names that carry newick metacharacters', async () => {
  const names = [
    'GM12878',
    'Primary T helper naive cells from peripheral blood (BLD.CD4.NPC)',
    'Breast variant Human Mammary Epithelial Cells (vHMEC)',
    'has, a comma',
    "o'brien",
    'chr1:100-200',
    'NA18536 HP0',
  ]
  const { order, tree } = await clusterMatrix({
    data: new Map(names.map((n, i) => [n, [i, i * 2]])),
  })

  expect(leafNames(parseNewick(tree))).toHaveLength(names.length)
  expect(new Set(leafNames(parseNewick(tree)))).toEqual(new Set(names))
  // `order` is indices into the matrix's key insertion order, and the tree's
  // leaves are those same rows in the clustered order — the invariant
  // `treeDescribesRows` checks before it will position a dendrogram.
  expect(leafNames(parseNewick(tree))).toEqual(order.map(i => names[i]))
})

// The other way the same invariant breaks, and the reason the matrix is a Map:
// a plain object hoists integer-like keys into numeric order, so the rows a
// caller built as 10, 2, 1 reached hclust as 1, 2, 10 and the indices it handed
// back pointed at the wrong sources. Reachable from numbered bigWig filenames,
// numeric VCF sample IDs, or a numeric partition field.
test('keeps numeric-looking row names in the caller order', async () => {
  const names = ['10', '2', '1']
  const { order, tree } = await clusterMatrix({
    data: new Map(names.map((n, i) => [n, [i, i * 2]])),
  })
  expect(leafNames(parseNewick(tree))).toEqual(order.map(i => names[i]))
})

test('leaves a plain row name unquoted', async () => {
  const { tree } = await clusterMatrix({
    data: new Map([
      ['GM12878', [0, 0]],
      ['K562', [1, 1]],
      ['HepG2', [5, 5]],
    ]),
  })
  expect(tree).not.toContain("'")
  expect(new Set(leafNames(parseNewick(tree)))).toEqual(
    new Set(['GM12878', 'K562', 'HepG2']),
  )
})

// We escape nothing ourselves, which is only correct while hclust escapes. It
// has since 4.0.3; before that `clusterMatrix` quoted the names on the way in,
// and quoting on both sides would be worse than on neither (`''vHMEC''` matches
// no row). So assert the dependency's half rather than trusting it — if a
// future hclust stops quoting, this fails here instead of the dendrogram
// quietly disappearing again.
test('hclust escapes leaf names, which is why clusterMatrix does not', () => {
  expect(toNewick({ name: 'cells (vHMEC)', height: 0 })).toBe("'cells (vHMEC)'")
  expect(toNewick({ name: 'Sample 0', height: 0 })).toBe('Sample 0')
})

// Every menu row and dialog gate on the way here says "needs at least two
// rows", and two of the four run functions say it as "at least one" — so a
// single-row track reached hclust, which has nothing to merge and returns a
// tree with no structure. Refused once, at the point all four RPCs pass
// through.
test('refuses a matrix with fewer than two rows', async () => {
  await expect(
    clusterMatrix({ data: new Map([['GM12878', [0, 0]]]) }),
  ).rejects.toThrow(/at least 2 rows, got 1/)
  await expect(clusterMatrix({ data: new Map() })).rejects.toThrow(
    /at least 2 rows, got 0/,
  )
})
