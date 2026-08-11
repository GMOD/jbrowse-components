import { SimpleFeature } from '@jbrowse/core/util'

import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Region } from '@jbrowse/core/util'

// Re-fetch one full feature by id for the details widget. Both canvas displays
// paint from slim render arrays that carry no attributes, so the complete
// feature is fetched on demand; a failure notifies and answers undefined rather
// than throwing into a click handler.
//
// Structural `session` param (not the MST session type) so this stays a plain
// function both displays and their tests can call.
export async function fetchCanvasFeatureDetails(
  session: {
    rpcManager: RpcManager
    notifyError: (msg: string, err?: unknown) => void
  },
  sessionId: string,
  adapterConfig: Record<string, unknown>,
  featureId: string,
  region: Region,
) {
  try {
    const result = await session.rpcManager.call(
      sessionId,
      'GetCanvasFeatureDetails',
      { adapterConfig, featureId, region },
    )
    return result.feature ? new SimpleFeature(result.feature) : undefined
  } catch (e) {
    console.error('Failed to fetch feature details:', e)
    session.notifyError(`${e}`, e)
    return undefined
  }
}
