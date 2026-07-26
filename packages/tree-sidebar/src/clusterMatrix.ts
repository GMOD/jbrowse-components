import { clusterObject, toNewick } from '@gmod/hclust'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { clusterProgressStatus } from './clusterProgressStatus.ts'

import type { StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

/**
 * The tail every clustering RPC shares: hand a name→values matrix to hclust,
 * forward its progress onto the status channel, and return the row `order` plus
 * the tree as newick. What differs between the multi-sample-variant, multi-wiggle
 * and multi-row-feature RPCs is only how the matrix is built.
 *
 * `order` is indices into the matrix's key insertion order, which is what
 * `buildClusteredLayout` maps back through — so a caller must build `data` in
 * its own row order.
 */
export async function clusterMatrix({
  data,
  statusCallback,
  stopTokenCheck,
}: {
  data: Record<string, ArrayLike<number>>
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}) {
  const result = await clusterObject({
    data,
    onProgress: p => {
      statusCallback?.(clusterProgressStatus(p))
    },
    checkCancellation: () => {
      checkStopToken2(stopTokenCheck)
    },
  })
  return { order: result.order, tree: toNewick(result.tree) }
}
