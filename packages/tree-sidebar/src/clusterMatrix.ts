import { clusterData, toNewick } from '@gmod/hclust'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import { clusterProgressStatus } from './clusterProgressStatus.ts'

import type { StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

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
  data: Map<string, ArrayLike<number>>
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}) {
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
