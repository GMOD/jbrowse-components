import { clusterData, toNewick } from '@gmod/hclust'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import { clusterProgressStatus } from './clusterProgressStatus.ts'

import type { StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

// One matrix row. Both halves of the clustering path read it and they read it
// differently — hclust indexes it, the R-script and TSV serializers iterate it —
// so the contract is the intersection rather than whichever half a caller
// happened to be written against. `number[]` and every TypedArray satisfy both;
// a bare generator does not, and it could not have been handed to hclust anyway.
export type NumericRow = ArrayLike<number> & Iterable<number>

// A Map, not a Record, because the row order IS the contract: `order` comes back
// as indices into it and every caller maps those straight into its own source
// list. A plain object cannot carry that — it hoists integer-like keys ahead of
// the rest, so rows named "1", "2", "10" (numbered bigWigs, numeric VCF sample
// IDs, a numeric partition field) arrived at the clusterer in numeric order and
// the indices it returned pointed at the wrong sources. What made that expensive
// to notice is that it fails twice over: the rows reorder to the wrong
// identities, and the tree's leaf names then disagree with them, so
// `treeDescribesRows` refuses to draw the dendrogram that would have shown it.
export type ClusterMatrix = Map<string, NumericRow>

/**
 * Fewest rows a hierarchical clustering can be asked for. One row has no
 * neighbour to merge with, so there is no tree and no order to return; the
 * dendrogram is then either absent or a single leaf drawn over a row that was
 * never moved.
 *
 * Every menu row, dialog gate and `ready()` predicate on the way here states
 * this same rule, and two of the run functions state it as `length > 0` — so
 * the refusal lives at the one point all four RPCs pass through, and the gates
 * upstream are there to keep the user from reaching it rather than to be the
 * only thing that does.
 */
export const MIN_CLUSTER_ROWS = 2

/**
 * The tail every clustering RPC shares: hand a name→values matrix to hclust,
 * forward its progress onto the status channel, and return the row `order` plus
 * the tree as newick. What differs between the multi-sample-variant, multi-wiggle
 * and multi-row-feature RPCs is only how the matrix is built.
 *
 * `order` is indices into the matrix's key order, which is what
 * `buildClusteredLayout` maps back through — so a caller must build `data` in
 * its own row order. A Map because that is the only container that keeps it: see
 * `ClusterMatrix` for what a plain object did to rows named "1", "2", "10".
 *
 * Leaf names arrive here as arbitrary strings from somebody's data file, so
 * they have to be escaped before they go into a newick string. `toNewick` owns
 * that from @gmod/hclust 4.0.3 — we quoted here until it did, and quoting on
 * both sides would be worse than quoting on neither.
 */
export async function clusterMatrix({
  data,
  statusCallback,
  stopTokenCheck,
}: {
  data: ClusterMatrix
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}) {
  if (data.size < MIN_CLUSTER_ROWS) {
    throw new Error(
      `Clustering needs at least ${MIN_CLUSTER_ROWS} rows, got ${data.size}`,
    )
  }
  // hclust takes parallel arrays, so the map is walked once into both rather
  // than spread twice. This is the only place the two are ever separated.
  const rows: ArrayLike<number>[] = []
  const sampleLabels: string[] = []
  for (const [name, row] of data) {
    sampleLabels.push(name)
    rows.push(row)
  }
  const result = await clusterData({
    data: rows,
    sampleLabels,
    onProgress: p => {
      statusCallback?.(clusterProgressStatus(p))
    },
    checkCancellation: () => {
      checkStopTokenThrottled(stopTokenCheck)
    },
  })
  return { order: result.order, tree: toNewick(result.tree) }
}
