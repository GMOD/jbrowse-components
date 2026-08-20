import { overByteBudget } from '@jbrowse/core/rpc/byteBudget'
import { updateStatus } from '@jbrowse/core/util'
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
  // Labelled, because this is the FIRST thing a feature fetch does and it used
  // to be the one stretch of a fetch with no phase open at all: the display had
  // just cleared its status, so the overlay showed its `statusMessage ||
  // 'Loading'` fallback until the download phase opened. Every refetch flashed
  // "Loading" for as long as the estimate took.
  //
  // It does paint even when the estimate is instant, unlike a phase in the
  // middle of a fetch: a fetch begins by reopening the throttle window, so its
  // first status is always on a leading edge. What that buys is the label being
  // true while it is up — an index read that has to go to the network is
  // exactly the case the overlay used to call "Loading" — and the download
  // phase's own first status displaces it a window later at the outside.
  const bytes = await updateStatus('Checking region size', statusCallback, () =>
    dataAdapter.getRegionByteSize([region], { stopToken, statusCallback }),
  )
  checkStopTokenThrottled(stopTokenCheck)
  return overByteBudget(bytes, byteLimit)
    ? { bytes, tooLarge: { regionTooLarge: true, bytes } }
    : { bytes }
}
