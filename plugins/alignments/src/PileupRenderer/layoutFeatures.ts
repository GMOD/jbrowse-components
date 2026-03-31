import { readConfObject } from '@jbrowse/core/configuration'

import { getPileupLayoutSpan, layoutFeature } from './layoutFeature.ts'
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
  const maxClippingSize = readConfObject(config, 'maxClippingSize') as number

  // Sort by layout left edge (expanded when soft clipping) so iteration order
  // matches PileupLayout's row-hint optimization (#4671). Plain start order
  // disagrees with collision intervals when clips extend reads leftward.
  const featureArr = hasSortedBy
    ? [...featureMap.values()]
    : [...featureMap.values()].sort((a, b) => {
        const { s: as } = getPileupLayoutSpan(a, !!showSoftClip, maxClippingSize)
        const { s: bs } = getPileupLayoutSpan(b, !!showSoftClip, maxClippingSize)
        if (as !== bs) {
          return as - bs
        }
        return a.get('start') - b.get('start')
      })

  const layoutRecords: LayoutFeature[] = []

  for (const feature of featureArr) {
    const result = layoutFeature({
      feature,
      layout,
      showSoftClip,
      heightPx,
      displayMode,
      maxClippingSize,
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
