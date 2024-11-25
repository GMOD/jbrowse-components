import { readConfObject } from '@jbrowse/core/configuration'
import { iterMap } from '@jbrowse/core/util'

// locals
import { layoutFeature } from './layoutFeature'
import { sortFeature } from './sortUtil'
import type { RenderArgsDeserializedWithFeaturesAndLayout } from './PileupRenderer'

// layout determines the height of the canvas that we use to render
export function layoutFeats(
  props: RenderArgsDeserializedWithFeaturesAndLayout,
) {
  const { layout, features, sortedBy, config, bpPerPx, showSoftClip, regions } =
    props
  const region = regions[0]!
  const featureMap =
    sortedBy?.type && region.start === sortedBy.pos
      ? sortFeature(features, sortedBy)
      : features

  const heightPx = readConfObject(config, 'height')
  const displayMode = readConfObject(config, 'displayMode')
  return iterMap(
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
  )
}
