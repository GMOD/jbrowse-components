import type { LayoutFeature } from './types.ts'
import type { Mismatch } from '../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

/**
 * Genomic interval used for pileup collision detection. When soft clipping is
 * on, left/right edges follow mismatch clips (capped by maxClippingSize).
 * Must match the order used when laying out features — see layoutFeats sort
 * (#4671).
 */
export function getPileupLayoutSpan(
  feature: Feature,
  showSoftClip: boolean,
  maxClippingSize: number,
): { s: number; e: number } {
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  let s = featureStart
  let e = featureEnd

  if (showSoftClip) {
    const mismatches = feature.get('mismatches') as Mismatch[] | undefined
    if (mismatches) {
      let leftExtra = 0
      let rightExtra = 0
      for (const mismatch of mismatches) {
        if (mismatch.type === 'softclip') {
          const cliplen = mismatch.cliplen
          if (mismatch.start === 0) {
            leftExtra += cliplen
          } else {
            rightExtra += cliplen
          }
        }
      }
      s -= Math.min(leftExtra, maxClippingSize)
      e += Math.min(rightExtra, maxClippingSize)
    }
  }
  return { s, e }
}

export function layoutFeature({
  feature,
  layout,
  showSoftClip,
  heightPx,
  displayMode,
  maxClippingSize,
}: {
  feature: Feature
  layout: BaseLayout<Feature>
  showSoftClip?: boolean
  heightPx: number
  displayMode: string
  /** Caps soft-clip expansion for layout; matches PileupRenderer region expansion (#3471). */
  maxClippingSize: number
}): LayoutFeature | null {
  const { s, e } = getPileupLayoutSpan(
    feature,
    !!showSoftClip,
    maxClippingSize,
  )

  if (displayMode === 'compact') {
    heightPx /= 3
  }

  const topPx = layout.addRect(feature.id(), s, e, heightPx, feature)
  if (topPx === null) {
    return null
  }

  return {
    feature,
    topPx: displayMode === 'collapse' ? 0 : topPx,
    heightPx,
  }
}
