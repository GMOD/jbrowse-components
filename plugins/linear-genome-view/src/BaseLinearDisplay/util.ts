import { SimpleFeature } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

/**
 * Fetch a feature by ID via RPC from the renderer's layout cache.
 * For subfeatures, fetches the parent and finds the subfeature within it.
 */
export async function fetchFeatureByIdRpc({
  rpcManager,
  sessionId,
  trackId,
  rendererType,
  featureId,
  parentFeatureId,
}: {
  rpcManager: RpcManager
  sessionId: string
  trackId: string
  rendererType: string
  featureId: string
  parentFeatureId?: string
}): Promise<Feature | undefined> {
  // Fetch the feature (or parent if looking for subfeature)
  const lookupId = parentFeatureId || featureId
  const { feature: featureData } = (await rpcManager.call(
    sessionId,
    'CoreGetFeatureDetails',
    {
      featureId: lookupId,
      sessionId,
      trackInstanceId: trackId,
      rendererType,
    },
  )) as { feature: Record<string, unknown> | undefined }

  if (!featureData) {
    return undefined
  }

  const feature = new SimpleFeature(featureData)

  // If looking for a subfeature, find it within the parent
  if (parentFeatureId) {
    return findSubfeatureById(feature, featureId)
  }

  return feature
}

/**
 * Recursively searches a feature's subfeatures for one with the given ID
 */
export function findSubfeatureById(
  feature: Feature,
  targetId: string,
): Feature | undefined {
  const subfeatures = feature.get('subfeatures')
  if (subfeatures) {
    for (const sub of subfeatures) {
      if (sub.id() === targetId) {
        return sub
      }
      const found = findSubfeatureById(sub, targetId)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

export function hasExonsOrCDS(transcripts: Feature[]) {
  return transcripts.some(t => {
    const subs = t.get('subfeatures') ?? []
    return subs.some(f => f.get('type') === 'exon' || f.get('type') === 'CDS')
  })
}

export function getTranscripts(feature?: Feature): Feature[] {
  if (!feature) {
    return []
  }
  return feature.get('type') === 'mRNA'
    ? [feature]
    : (feature.get('subfeatures') ?? [])
}
