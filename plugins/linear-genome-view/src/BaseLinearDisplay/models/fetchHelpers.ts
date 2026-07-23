import { AUTO_FORCE_LOAD_BP } from '../../LinearGenomeView/model.ts'

import type { RegionByteEstimate } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

export interface ByteEstimateConfig {
  adapterConfig: Record<string, unknown>
  visibleBp: number
}

/**
 * Pre-flight byte estimate for a region set, feeding `RegionTooLargeMixin`'s
 * derived region-too-large gate. Undefined below the `AUTO_FORCE_LOAD_BP`
 * force-load floor or when the fetch went stale. The too-large *verdict* is
 * derived from the estimate by the gate (`tooLargeStatus`), not computed here;
 * this is purely the estimate RPC plus the force-load-floor short-circuit.
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
): Promise<RegionByteEstimate | undefined> {
  if (config.visibleBp < AUTO_FORCE_LOAD_BP) {
    return undefined
  }
  const estimate = await rpcManager.call(
    sessionId,
    'CoreGetRegionByteEstimate',
    {
      regions,
      adapterConfig: config.adapterConfig,
    },
  )
  return ctx.isStale() ? undefined : estimate
}
