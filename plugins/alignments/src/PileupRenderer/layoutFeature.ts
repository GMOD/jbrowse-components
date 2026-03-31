import type { LayoutFeature } from './types.ts'
import type { Mismatch } from '../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

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
  // Cache start/end to avoid multiple get() calls
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')

  let s = featureStart
  let e = featureEnd

  // Expand the start and end of feature when softclipping enabled, capped by
  // maxClippingSize per side (same bound as getExpandedRegion) so layout
  // intervals cannot exceed what the block fetch accounts for.
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
