import { overByteBudget } from '@jbrowse/core/rpc/byteBudget'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import type { RegionTooLargeResult, RenderFeatureDataArgs } from './rpcTypes.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken, StopTokenChecker } from '@jbrowse/core/util/stopToken'

/**
 * Stage 1 of every canvas feature fetch: the adapter's index-only byte estimate,
 * taken before any feature download, so an over-budget region short-circuits
 * without pulling data — on a whole-genome fan-out that's one cheap index read
 * per chromosome instead of every chromosome's features.
 *
 * `bytes` comes back either way (undefined when the adapter offers no index
 * estimate, or when there is no budget to check against), because the result
 * carries it to the main-thread gate whether or not this region tripped. When
 * `tooLarge` is set the caller must return it as-is and fetch nothing.
 *
 * Shared by both feature RPCs (`executeRenderFeatureData`,
 * `executeMultiRowGetFeatures`) so the two can't drift — the density axis has
 * the same arrangement in `densityGate.ts`. See
 * agent-docs/reference/REGION_TOO_LARGE.md.
 */
export async function measureRegionBytes({
  dataAdapter,
  region,
  byteLimit,
  stopToken,
  statusCallback,
  stopTokenCheck,
}: {
  dataAdapter: BaseFeatureDataAdapter
  region: RenderFeatureDataArgs['region']
  byteLimit: number | undefined
  stopToken?: StopToken
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}): Promise<{ bytes?: number; tooLarge?: RegionTooLargeResult }> {
  if (byteLimit === undefined) {
    return {}
  }
  const bytes = await dataAdapter.getRegionByteSize([region], {
    stopToken,
    statusCallback,
  })
  checkStopTokenThrottled(stopTokenCheck)
  return overByteBudget(bytes, byteLimit)
    ? { bytes, tooLarge: { regionTooLarge: true, bytes } }
    : { bytes }
}
