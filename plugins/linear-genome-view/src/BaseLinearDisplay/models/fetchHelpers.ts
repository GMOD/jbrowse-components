import { AUTO_FORCE_LOAD_BP } from '../../LinearGenomeView/model.ts'
import {
  evaluateRegionTooLarge,
  resolveByteLimit,
} from '../../shared/featureDensityUtils.ts'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

export interface ByteEstimateConfig {
  adapterConfig: Record<string, unknown>
  fetchSizeLimit: number
  userByteSizeLimit?: number
  visibleBp: number
}

export interface ByteEstimateResult {
  stats: FeatureDensityStats
  tooLarge: boolean
  reason?: string
}

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
): Promise<ByteEstimateResult | null> {
  if (config.visibleBp < AUTO_FORCE_LOAD_BP) {
    return null
  }

  const stats = await rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
    regions,
    adapterConfig: config.adapterConfig,
  })

  if (ctx.isStale()) {
    return null
  }

  // Same verdict helper as the arc and canvas paths, so the too-large decision
  // and banner text can't drift between gating paths. This path measures bytes
  // only (no density sample), so densityTooLarge is left unset.
  const { tooLarge, reason } = evaluateRegionTooLarge({
    visibleBp: config.visibleBp,
    bytes: stats.bytes,
    byteLimit: resolveByteLimit({
      userByteSizeLimit: config.userByteSizeLimit,
      adapterFetchSizeLimit: stats.fetchSizeLimit,
      configFetchSizeLimit: config.fetchSizeLimit,
    }),
    alwaysRender: stats.alwaysRender,
  })

  return { stats, tooLarge, reason }
}
