import { SimpleFeature } from '@jbrowse/core/util'

import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature } from '@jbrowse/core/util'

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
  const { feature: featureData } = await rpcManager.call(
    sessionId,
    'CoreGetFeatureDetails',
    {
      featureId: lookupId,
      sessionId,
      trackInstanceId: trackId,
      rendererType,
    },
  )

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

/**
 * Draws an ImageBitmap to a canvas element.
 * This is a shared utility for non-block-based displays that render
 * to a single canvas via RPC.
 *
 * @param canvas - The canvas element to draw to
 * @param imageData - The ImageBitmap to draw
 * @returns true if drawing was successful, false otherwise
 */
export function drawCanvasImageData(
  canvas: HTMLCanvasElement | null,
  imageData: ImageBitmap | undefined,
): boolean {
  if (!canvas || !imageData) {
    return false
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return false
  }

  ctx.resetTransform()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(imageData, 0, 0)
  return true
}
