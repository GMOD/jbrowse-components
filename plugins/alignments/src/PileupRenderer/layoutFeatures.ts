import { readConfObject } from '@jbrowse/core/configuration'
import { iterMap } from '@jbrowse/core/util'

// locals
import { layoutFeature } from './layoutFeature'
import { RenderArgsDeserializedWithFeaturesAndLayout } from './PileupRenderer'
import { sortFeature } from './sortUtil'

// layout determines the height of the canvas that we use to render
export function layoutFeats(
  props: RenderArgsDeserializedWithFeaturesAndLayout,
) {
  const { layout, features, sortedBy, config, bpPerPx, showSoftClip, regions } =
    props
  const [region] = regions
  if (!layout) {
    throw new Error(`layout required`)
  }
  if (!layout.addRect) {
    throw new Error('invalid layout object')
  }

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
