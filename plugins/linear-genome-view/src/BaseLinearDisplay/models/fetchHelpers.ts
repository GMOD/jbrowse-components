import { getDisplayStr } from './util.ts'
import { AUTO_FORCE_LOAD_BP } from '../../LinearGenomeView/model.ts'

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

  // Replicate the FeatureDensityMixin.maxAllowableBytes fallback chain:
  // userByteSizeLimit || adapter.fetchSizeLimit || display.fetchSizeLimit
  const effectiveLimit =
    config.userByteSizeLimit || stats.fetchSizeLimit || config.fetchSizeLimit

  // eslint-disable-next-line no-console
  console.debug(
    `[byte-estimate] bytes=${stats.bytes ?? 'n/a'} effectiveLimit=${effectiveLimit} (user=${config.userByteSizeLimit ?? 'n/a'}, adapter=${stats.fetchSizeLimit ?? 'n/a'}, display=${config.fetchSizeLimit}) visibleBp=${config.visibleBp}`,
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
