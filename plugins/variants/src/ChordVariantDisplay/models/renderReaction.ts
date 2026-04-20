import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

// Returns a stable string key so MobX === comparison works — only changes
// when the actual feature data would change (regions or adapter), never on zoom.
export function renderReactionData(self: any) {
  const view = getContainingView(self) as CircularViewModel
  if (!view.displayedRegions.length) {
    return undefined
  }
  return JSON.stringify({
    assemblyName: view.displayedRegions[0]!.assemblyName,
    regions: view.displayedRegions,
    adapterConfig: self.adapterConfig,
  })
}

// self is passed as the third argument by makeAbortableReaction
export async function renderReactionEffect(
  key: string | undefined,
  stopToken: StopToken,
  self: any,
) {
  if (!key) {
    return { message: 'Skipping render' }
  }

  const view = getContainingView(self) as CircularViewModel
  const { rendererType } = self
  const { rpcManager } = getSession(view)

  // Snapshot block definitions NOW (before the async fetch) so they're stable.
  // These are captured once and never re-read on zoom.
  const cachedSlices = self.blockDefinitions

  console.log('[chord] fetching features (regions/adapter changed)')
  const result = await rendererType.renderInClient(rpcManager, {
    assemblyName: view.displayedRegions[0]!.assemblyName,
    adapterConfig: structuredClone(self.adapterConfig),
    rendererType: rendererType.name,
    regions: structuredClone(view.displayedRegions),
    sessionId: getRpcSessionId(self),
    trackInstanceId: getContainingTrack(self).id,
    timeout: 1000000,
    ...self.renderProps(),
    stopToken,
  })
  console.log('[chord] features fetched:', result.features?.size)

  return {
    features: result.features as Map<string, Feature>,
    cachedSlices,
  }
}
