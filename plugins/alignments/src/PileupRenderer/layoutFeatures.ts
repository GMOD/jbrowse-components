import { readConfObject } from '@jbrowse/core/configuration'

import { layoutFeature } from './layoutFeature'
import { sortFeature } from './sortUtil'

import type { LayoutRecord } from './layoutFeature'
import type { PreProcessedRenderArgs } from './types'

// layout determines the height of the canvas that we use to render
export function layoutFeats(props: PreProcessedRenderArgs) {
  const { layout, features, sortedBy, config, bpPerPx, showSoftClip, regions } =
    props
  const region = regions[0]!
  const featureMap =
    sortedBy?.type && region.start === sortedBy.pos
      ? sortFeature(features, sortedBy)
      : features

  const heightPx = readConfObject(config, 'height')
  const displayMode = readConfObject(config, 'displayMode')

  // Sort features by start position for PileupLayout's built-in hint optimization
  const featureArr = [...featureMap.values()].sort(
    (a, b) => a.get('start') - b.get('start'),
  )

  const layoutRecords: LayoutRecord[] = []

  for (const feature of featureArr) {
    const result = layoutFeature({
      feature,
      layout,
      bpPerPx,
      region,
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
