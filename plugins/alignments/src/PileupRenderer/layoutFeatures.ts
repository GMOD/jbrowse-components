import { readConfObject } from '@jbrowse/core/configuration'

import { layoutFeature } from './layoutFeature.ts'
import { sortFeature } from './sortUtil.ts'

import type { LayoutFeature, PreProcessedRenderArgs } from './types.ts'

// layout determines the height of the canvas that we use to render
export function layoutFeats(props: PreProcessedRenderArgs) {
  const { layout, features, sortedBy, config, showSoftClip, regions } = props
  const region = regions[0]!
  const hasSortedBy = sortedBy?.type && region.start === sortedBy.pos
  const featureMap = hasSortedBy ? sortFeature(features, sortedBy) : features

  const heightPx = readConfObject(config, 'height')
  const displayMode = readConfObject(config, 'displayMode')

  // Sort features by start position for PileupLayout's built-in hint optimization,
  // but only when not using explicit sorting (which has its own order)
  const featureArr = hasSortedBy
    ? [...featureMap.values()]
    : [...featureMap.values()].sort((a, b) => a.get('start') - b.get('start'))

  const layoutRecords: LayoutFeature[] = []

  for (const feature of featureArr) {
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
