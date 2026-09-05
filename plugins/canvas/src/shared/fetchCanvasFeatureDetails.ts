import { SimpleFeature } from '@jbrowse/core/util'

import { featureSpanEndBp } from './featureSpanBp.ts'

import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// A zero-length feature is straddled rather than grown from its start edge:
// adapters keep a feature on `end > queryStart && start < queryEnd`, and a
// query of [pos, pos + 1] fails the first half against a feature whose own end
// is pos, dropping exactly the feature the widening was for.
export function featureSpanRegion(
  region: Region,
  startBp: number,
  endBp: number,
): Region {
  return {
    ...region,
    start: endBp > startBp ? startBp : Math.max(0, startBp - 1),
    end: featureSpanEndBp(startBp, endBp),
  }
}

// Errors are let out and `undefined` means the adapter found nothing;
// `withFeatureDetails` reports both, so collapsing them here would lose the
// only point that can still tell them apart.
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
