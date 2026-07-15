import { AUTO_FORCE_LOAD_BP } from '../../LinearGenomeView/model.ts'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

export interface ByteEstimateConfig {
  adapterConfig: Record<string, unknown>
  visibleBp: number
}

/**
 * Pre-flight byte estimate for a region set. Returns the adapter's feature-
 * density stats — which feed `RegionTooLargeMixin`'s derived region-too-large
 * gate — or undefined below the `AUTO_FORCE_LOAD_BP` force-load floor or when the
 * fetch went stale. The too-large *verdict* is derived from these stats by the
 * gate (`tooLargeStatus`), not computed here; this is purely the estimate RPC
 * plus the force-load-floor short-circuit.
 */
export async function checkByteEstimate(
  rpcManager: Pick<RpcManager, 'call'>,
  sessionId: string,
  regions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[],
  config: ByteEstimateConfig,
  ctx: { isStale: () => boolean },
): Promise<FeatureDensityStats | undefined> {
  if (config.visibleBp < AUTO_FORCE_LOAD_BP) {
    return undefined
  }
  const stats = await rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
    regions,
    adapterConfig: config.adapterConfig,
  })
  return ctx.isStale() ? undefined : stats
}
