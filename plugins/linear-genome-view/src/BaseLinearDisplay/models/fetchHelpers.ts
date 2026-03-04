import { getDisplayStr } from './util.ts'

export const AUTO_FORCE_LOAD_BP = 20_000

interface ByteEstimateCallbacks {
  setFeatureDensityStats: (stats: { bytes?: number; fetchSizeLimit?: number }) => void
  setRegionTooLarge: (val: boolean, reason?: string) => void
}

export async function checkByteEstimate(
  rpcManager: { call: (sessionId: string, method: string, args: Record<string, unknown>) => Promise<unknown> },
  sessionId: string,
  regions: { refName: string; start: number; end: number; assemblyName: string }[],
  adapterConfig: unknown,
  fetchSizeLimit: number,
  visibleBp: number,
  ctx: { isStale: () => boolean },
  callbacks: ByteEstimateCallbacks,
) {
  if (visibleBp < AUTO_FORCE_LOAD_BP) {
    return true
  }

  const stats = (await rpcManager.call(
    sessionId,
    'CoreGetFeatureDensityStats',
    { regions, adapterConfig },
  )) as { bytes?: number; fetchSizeLimit?: number }

  if (ctx.isStale()) {
    return false
  }

  callbacks.setFeatureDensityStats(stats)

  if (stats.bytes && stats.bytes > fetchSizeLimit) {
    console.debug('[checkByteEstimate] regionTooLarge', {
      bytes: stats.bytes,
      limit: fetchSizeLimit,
    })
    callbacks.setRegionTooLarge(
      true,
      `Requested too much data (${getDisplayStr(stats.bytes)})`,
    )
    return false
  }

  return true
}
