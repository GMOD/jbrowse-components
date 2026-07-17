import type { ClusterProgress } from '@gmod/hclust'
import type { RpcStatus } from '@jbrowse/core/util'

/**
 * Maps an hclust progress report onto the RPC status channel, giving each phase
 * half the bar: the distance matrix spans 0-50% and the clustering merge loop
 * 50-100%. Both phases count 0→100% independently upstream, so forwarding their
 * counts raw makes the bar fill, snap back to zero, and fill again. 'init' has
 * no denominator, so it stays a plain (indeterminate) message.
 */
export function clusterProgressStatus({
  phase,
  message,
  current,
  total,
}: ClusterProgress): RpcStatus {
  return phase === 'init'
    ? message
    : {
        message,
        current: phase === 'distance' ? current : total + current,
        total: total * 2,
      }
}
