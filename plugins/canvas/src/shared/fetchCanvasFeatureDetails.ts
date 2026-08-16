import { SimpleFeature } from '@jbrowse/core/util'

import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// Re-fetch one full feature by id for the details widget. Both canvas displays
// paint from slim render arrays that carry no attributes, so the complete
// feature is fetched on demand.
//
// **Errors are let out, and `undefined` means the adapter found nothing.** This
// used to catch and notify, answering `undefined` either way — which collapsed
// the two into one value at the only point that could still tell them apart, so
// a caller reporting an empty answer reported failures a second time and less
// usefully. `withFeatureDetails` owns both halves now, the same way the pileup's
// wrapper does.
//
// Structural `session` param (not the MST session type) so this stays a plain
// function both displays and their tests can call.
export async function fetchCanvasFeatureDetails(
  session: { rpcManager: RpcManager },
  sessionId: string,
  adapterConfig: Record<string, unknown>,
  featureId: string,
  region: Region,
  opts: { stopToken?: StopToken; statusCallback?: StatusCallback } = {},
) {
  const result = await session.rpcManager.call(
    sessionId,
    'GetCanvasFeatureDetails',
    { adapterConfig, featureId, region, ...opts },
  )
  return result.feature ? new SimpleFeature(result.feature) : undefined
}
