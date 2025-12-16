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

  // Sort features by start position for better layout performance
  // This allows us to use row hints for overlapping features
  const featureArr = [...featureMap.values()].sort(
    (a, b) => a.get('start') - b.get('start'),
  )

  const layoutRecords: LayoutRecord[] = []

  // Track previous feature for same-start detection
  let prevStart = -Infinity
  let prevTopPx = 0
  let prevHeightPx = heightPx

  for (const feature of featureArr) {
    const start = feature.get('start')

    // Only use hint when features have exact same start position
    // In this case, we know they must stack (no gaps possible)
    const startingRow = start === prevStart ? prevTopPx + prevHeightPx : undefined

    const result = layoutFeature({
      feature,
      layout,
      bpPerPx,
      region,
      showSoftClip,
      heightPx,
      displayMode,
      startingRow,
    })

    if (result) {
      layoutRecords.push(result)
      prevStart = start
      prevTopPx = result.topPx
      prevHeightPx = result.heightPx
    }
  }

  return {
    layoutRecords,
    height: Math.max(layout.getTotalHeight(), 1),
  }
}
