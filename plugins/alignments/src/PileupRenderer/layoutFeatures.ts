import { readConfObject } from '@jbrowse/core/configuration'
import { iterMap, notEmpty } from '@jbrowse/core/util'

import { layoutFeature } from './layoutFeature'
import { sortFeature } from './sortUtil'

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
  const layoutRecords = iterMap(
    featureMap.values(),
    feature =>
      layoutFeature({
        feature,
        layout,
        bpPerPx,
        region,
        showSoftClip,
        heightPx,
        displayMode,
      }),
    featureMap.size,
  ).filter(notEmpty)

  return {
    layoutRecords,
    height: Math.max(layout.getTotalHeight(), 1),
  }
}
