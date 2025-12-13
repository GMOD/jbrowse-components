import { readConfObject } from '@jbrowse/core/configuration'

import { layoutFeature } from './layoutFeature'
import { sortFeature } from './sortUtil'

import type { LayoutFeature, PreProcessedRenderArgs } from './types'

// layout determines the height of the canvas that we use to render
export function layoutFeats(props: PreProcessedRenderArgs) {
  const { layout, features, sortedBy, config, showSoftClip, regions } = props
  const region = regions[0]!
  const featureMap =
    sortedBy?.type && region.start === sortedBy.pos
      ? sortFeature(features, sortedBy)
      : features

  const heightPx = readConfObject(config, 'height')
  const displayMode = readConfObject(config, 'displayMode')
  const layoutRecords: LayoutFeature[] = []
  for (const feature of featureMap.values()) {
    const result = layoutFeature({
      feature,
      layout,
      showSoftClip,
      heightPx,
      displayMode,
    })
    if (result) {
      layoutRecords.push(result)
    }
  }

  return {
    layoutRecords,
    height: Math.max(layout.getTotalHeight(), 1),
  }
}
