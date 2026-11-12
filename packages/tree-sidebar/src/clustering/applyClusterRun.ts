import { rotateClusterRun } from './rotateClusterRun.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'

export interface ClusterRunModel<S extends { name: string }> {
  editableSources: S[]
  rowSort: string[]
  setRowOrder: (
    rows: S[],
    run?: { tree?: string; provenance?: ClusterProvenance },
  ) => void
}

/**
 * Run a clustering matrix over `rows` and land the layout and tree together.
 * The row lists are read before the run, so a filter change while the worker
 * is busy cannot pair the order it hands back with a different row list.
 *
 * The run composes with the config `sort` rather than overwriting it:
 * `rotateClusterRun` turns the dendrogram towards the declared order and reads
 * the row order back off it, so a sort-seeded track keeps its leading rows as
 * early as the topology allows and still draws the tree.
 */
export async function applyClusterRun<S extends { name: string }>({
  model,
  rows,
  provenance,
  matrix,
}: {
  model: ClusterRunModel<S>
  rows: S[]
  provenance: ClusterProvenance
  matrix: () => Promise<{ order: number[]; tree?: string }>
}) {
  const { editableSources, rowSort } = model
  const { order, tree } = rotateClusterRun({
    rows,
    domain: rowSort,
    ...(await matrix()),
  })
  model.setRowOrder(clusteredCladeLayout({ rows, editableSources, order }), {
    tree,
    provenance,
  })
}

// Parse pasted R hclust output (a sequence of 1-based row indices, one per
// line, with possible blank/whitespace lines) into a numeric array. Callers map
// these 1-based indices into their source list.
export function parseClusterOrder(paste: string): number[] {
  return paste
    .split('\n')
    .map(t => t.trim())
    .filter(f => !!f)
    .map(r => +r)
}

// Where `rows` first stops matching the row list the matrix was built over, as
// a phrase to put in an error, or undefined when the two agree.
function clusterRowDrift(
  rows: readonly { name: string }[],
  matrixRowNames: readonly string[],
) {
  for (let i = 0; i < Math.min(rows.length, matrixRowNames.length); i++) {
    if (rows[i]!.name !== matrixRowNames[i]) {
      return `row ${i + 1} was "${matrixRowNames[i]}" and is now "${rows[i]!.name}"`
    }
  }
  return rows.length === matrixRowNames.length
    ? undefined
    : `the matrix had ${matrixRowNames.length} rows and there are now ${rows.length}`
}

// A pasted order is only meaningful if it's a full permutation of the rows: an
// out-of-range index, a partial paste or one with duplicates would silently
// drop or duplicate rows. Throw a clear error instead. `order` is 0-based.
//
// **And a permutation of the SAME rows.** `matrixRowNames` is the row list the
// exported matrix was built over, which is the order `generateClusterRScript`
// wrote into `rownames` and so the order `resultClusters$order` indexes. The
// rows move underneath a dialog that stays open across a trip to R: a region
// finishing its load discovers a new partition value, a phased expansion
// switches on, a sample filter changes. A count alone passes every one of those
// that swaps one row for another, and the ranks then land on rows that never
// entered the matrix, silently and with a dendrogram that still draws. Omitted
// where there is no exported matrix to compare against; an order straight from
// the clustering RPC always covers the rows it was handed.
//
// "entry N" is the **position** in the paste, and the value is reported beside
// it. It used to be `${idx + 1}` alone, which reads like a position but is the
// value — and `parseClusterOrder` is a bare `+`, so a stray word in the paste
// arrives as NaN and printed as "entry NaN is out of range 1-40", naming
// neither. This is the only feedback the user gets on a 200-line paste, so it
// has to say where to look.
//
// Position, not line number: `parseClusterOrder` drops blank lines, so the two
// disagree on exactly the pastes most likely to be malformed.
function validateClusterOrder(
  order: number[],
  rows: readonly { name: string }[],
  matrixRowNames?: readonly string[],
) {
  const { length } = rows
  const drift = matrixRowNames && clusterRowDrift(rows, matrixRowNames)
  if (drift) {
    throw new Error(
      `Invalid clustering order: the rows changed since the matrix was generated (${drift}). Re-generate the R script and paste the order it prints`,
    )
  }
  const seen = new Set<number>()
  for (const [i, idx] of order.entries()) {
    const at = `entry ${i + 1}`
    if (!Number.isInteger(idx)) {
      throw new Error(
        `Invalid clustering order: ${at} is not a whole number. Paste only the row numbers printed by cat(resultClusters$order), one per line`,
      )
    }
    if (idx < 0 || idx >= length) {
      throw new Error(
        `Invalid clustering order: ${at} is ${idx + 1}, outside the range 1-${length}`,
      )
    }
    if (seen.has(idx)) {
      throw new Error(`Invalid clustering order: ${at} repeats row ${idx + 1}`)
    }
    seen.add(idx)
  }
  if (order.length !== length) {
    throw new Error(
      `Invalid clustering order: expected ${length} entries, got ${order.length}`,
    )
  }
}

/**
 * A clustering run's `order` turned into the display's next row order — the
 * one write behind both the "Run clustering" RPC and a hand-pasted R order, on
 * every display that clusters its rows.
 *
 * `rows` is the row set the run CLUSTERED, and it is what the order indexes:
 * the same array whose names went to the worker. Under an active row focus
 * that is the focused clade, so a run resolves the structure WITHIN it rather
 * than handing back the whole-cohort tree — both the more useful answer and the
 * only one `computeClusterHierarchy` will draw, since it refuses a tree whose
 * leaves are not exactly the drawn rows in order (per band, under bands).
 *
 * **Undecorated rows, not the drawn `sources`.** Every display decorates on the
 * way to the painting — multi-wiggle synthesizes a palette, the multi-row
 * feature display tags `rows.groups` groups — and
 * the arrangement holds whatever it is handed, which is meant to be only what
 * the user chose. `editableSources` narrowed by the focus is the list.
 *
 * The rows the focus is hiding are re-appended rather than dropped:
 * `rows.sort` records every row's position, so losing them here would erase
 * them for good the moment the focus is cleared. They land after
 * the clustered block, which is a no-op with no focus active.
 *
 * `matrixRowNames` comes from the R-script path and names the rows the exported
 * matrix held, so a paste applied after the clustered rows moved (a filter
 * cleared, a guide tree arriving) is rejected rather than landing each rank on
 * its neighbour. The RPC path has none: its order came from the very array
 * passed here.
 */
export function clusteredCladeLayout<S extends { name: string }>({
  rows,
  editableSources,
  order,
  matrixRowNames,
}: {
  rows: readonly S[]
  editableSources: readonly S[]
  order: number[]
  matrixRowNames?: string[]
}): S[] {
  validateClusterOrder(order, rows, matrixRowNames)
  const clustered = order.map(idx => rows[idx]!)
  const clusteredNames = new Set(clustered.map(s => s.name))
  return [
    ...clustered,
    ...editableSources.filter(s => !clusteredNames.has(s.name)),
  ]
}
