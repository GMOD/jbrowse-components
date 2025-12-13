import type { Mismatch } from '../shared/types'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

export interface LayoutRecord {
  feature: Feature
  leftPx: number
  rightPx: number
  topPx: number
  heightPx: number
}

export function layoutFeature({
  feature,
  layout,
  bpPerPx,
  region,
  showSoftClip,
  heightPx,
  displayMode,
}: {
  feature: Feature
  layout: BaseLayout<Feature>
  bpPerPx: number
  region: Region
  showSoftClip?: boolean
  heightPx: number
  displayMode: string
}): LayoutRecord | null {
  // Cache start/end to avoid multiple get() calls
  const featureStart = feature.get('start') as number
  const featureEnd = feature.get('end') as number

  let expansionBefore = 0
  let expansionAfter = 0

  // Expand the start and end of feature when softclipping enabled
  if (showSoftClip) {
    const mismatches = feature.get('mismatches') as Mismatch[] | undefined
    if (mismatches) {
      for (const mismatch of mismatches) {
        if (mismatch.type === 'softclip') {
          const cliplen = mismatch.cliplen ?? 0
          if (mismatch.start === 0) {
            expansionBefore = cliplen
          } else {
            expansionAfter = cliplen
          }
        }
      }
    }
  }

  const s = featureStart - expansionBefore
  const e = featureEnd + expansionAfter

  if (displayMode === 'compact') {
    heightPx /= 3
  }

  const topPx = layout.addRect(feature.id(), s, e, heightPx, feature)
  if (topPx === null) {
    return null
  }

  const leftPx = region.reversed
    ? (region.end - e) / bpPerPx
    : (s - region.start) / bpPerPx
  const rightPx = region.reversed
    ? (region.end - s) / bpPerPx
    : (e - region.start) / bpPerPx

  return {
    feature,
    leftPx,
    rightPx,
    topPx: displayMode === 'collapse' ? 0 : topPx,
    heightPx,
  }
}
