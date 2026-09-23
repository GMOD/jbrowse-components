import { rotateClusterRun, validateClusterOrder } from '@jbrowse/tree-sidebar'

// Turn a cluster order over `rows` into the display's next row order, and the
// run's dendrogram into the one to store beside it. One home for the steps
// the auto ("Run clustering") and manual (R script paste) paths both take:
//
// - rotate the run's tree towards `rows.domain` and re-read the order off it,
//   so a declared order composes with the run instead of losing its leading
//   rows to it. The paste path passes no tree and rotates nothing.
// - re-append, after the clade, every row the focus hides, in the order
//   `arranged` gives them, so clearing the focus finds them where they were.
//
// `rows` are the rows clustered — at the mode's granularity, the haplotypes in
// phased mode, which the matrix was built over — so validation lives here: a
// hand-pasted order is where a short or duplicated list would otherwise drop or
// double rows, and where `matrixRowNames` catches a row set that moved during
// the trip to R, a focus or phasing switching on as `sampleInfo` arrives.
export function applyClusterOrder({
  rows,
  arranged,
  order,
  tree,
  domain = [],
  matrixRowNames,
}: {
  rows: readonly { name: string }[]
  arranged: readonly { name: string }[]
  order: number[]
  tree?: string
  domain?: readonly string[]
  matrixRowNames?: string[]
}): { order: { name: string }[]; tree?: string } {
  const rotated = rotateClusterRun({ rows, order, tree, domain })
  validateClusterOrder(rotated.order, rows, matrixRowNames)
  const clustered = rotated.order.map(idx => ({ name: rows[idx]!.name }))
  const names = new Set(clustered.map(row => row.name))
  return {
    order: [
      ...clustered,
      ...arranged
        .filter(row => !names.has(row.name))
        .map(row => ({ name: row.name })),
    ],
    tree: rotated.tree,
  }
}
