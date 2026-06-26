import { AUTO_FORCE_LOAD_BP } from '../../LinearGenomeView/model.ts'
import {
  bytesTooLargeReason,
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

  const effectiveLimit = resolveByteLimit({
    userByteSizeLimit: config.userByteSizeLimit,
    adapterFetchSizeLimit: stats.fetchSizeLimit,
    configFetchSizeLimit: config.fetchSizeLimit,
  })

  if (stats.bytes && stats.bytes > effectiveLimit) {
    return {
      stats,
      tooLarge: true,
      reason: bytesTooLargeReason(stats.bytes),
    }
  }

  return { stats, tooLarge: false }
}
