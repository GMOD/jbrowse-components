import { getDisplayStr } from './util.ts'
import { AUTO_FORCE_LOAD_BP } from '../../LinearGenomeView/model.ts'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

export interface ByteEstimateConfig {
  adapterConfig: Record<string, unknown>
  fetchSizeLimit: number
  visibleBp: number
}

export interface ByteEstimateResult {
  stats: FeatureDensityStats
  tooLarge: boolean
  reason?: string
}

export async function checkByteEstimate(
  rpcManager: RpcManager,
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

  // Use the adapter's fetchSizeLimit if available (e.g. BAM returns 5MB,
  // CRAM returns 3MB), falling back to the display config limit (1MB).
  // This matches the FeatureDensityMixin.maxAllowableBytes chain.
  const effectiveLimit = stats.fetchSizeLimit
    ? Math.max(stats.fetchSizeLimit, config.fetchSizeLimit)
    : config.fetchSizeLimit

  console.debug(
    `[byte-estimate] bytes=${stats.bytes ?? 'n/a'} effectiveLimit=${effectiveLimit} (adapter=${stats.fetchSizeLimit ?? 'n/a'}, display=${config.fetchSizeLimit}) visibleBp=${config.visibleBp}`,
  )

  if (stats.bytes && stats.bytes > effectiveLimit) {
    return {
      stats,
      tooLarge: true,
      reason: `Requested too much data (${getDisplayStr(stats.bytes)})`,
    }
  }

  return { stats, tooLarge: false }
}
