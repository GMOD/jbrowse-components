import type { LayoutFeature } from './types'
import type { Mismatch } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

export function layoutFeature({
  feature,
  layout,
  showSoftClip,
  heightPx,
  displayMode,
}: {
  feature: Feature
  layout: BaseLayout<Feature>
  showSoftClip?: boolean
  heightPx: number
  displayMode: string
}): LayoutFeature | null {
  // Cache start/end to avoid multiple get() calls
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')

  let s = featureStart
  let e = featureEnd

  // Expand the start and end of feature when softclipping enabled
  if (showSoftClip) {
    const mismatches = feature.get('mismatches') as Mismatch[] | undefined
    if (mismatches) {
      for (const mismatch of mismatches) {
        if (mismatch.type === 'softclip') {
          const cliplen = mismatch.cliplen
          if (mismatch.start === 0) {
            s -= cliplen
          } else {
            e += cliplen
          }
        }
      }
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
