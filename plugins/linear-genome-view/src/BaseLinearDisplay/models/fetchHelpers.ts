import { AUTO_FORCE_LOAD_BP } from '../../LinearGenomeView/model.ts'
import { getDisplayStr } from './util.ts'

export interface ByteEstimateConfig {
  adapterConfig: unknown
  fetchSizeLimit: number
  visibleBp: number
}

export interface ByteEstimateResult {
  stats: { bytes?: number; fetchSizeLimit?: number }
  tooLarge: boolean
  reason?: string
}

export async function checkByteEstimate(
  rpcManager: { call: (sessionId: string, method: string, args: Record<string, unknown>) => Promise<unknown> },
  sessionId: string,
  regions: { refName: string; start: number; end: number; assemblyName: string }[],
  config: ByteEstimateConfig,
  ctx: { isStale: () => boolean },
): Promise<ByteEstimateResult | null> {
  if (config.visibleBp < AUTO_FORCE_LOAD_BP) {
    return null
  }

  const stats = (await rpcManager.call(
    sessionId,
    'CoreGetFeatureDensityStats',
    { regions, adapterConfig: config.adapterConfig },
  )) as { bytes?: number; fetchSizeLimit?: number }

  if (ctx.isStale()) {
    return null
  }

  if (stats.bytes && stats.bytes > config.fetchSizeLimit) {
    console.debug('[checkByteEstimate] regionTooLarge', {
      bytes: stats.bytes,
      limit: config.fetchSizeLimit,
    })
    return {
      stats,
      tooLarge: true,
      reason: `Requested too much data (${getDisplayStr(stats.bytes)})`,
    }
  }

  return { stats, tooLarge: false }
}
