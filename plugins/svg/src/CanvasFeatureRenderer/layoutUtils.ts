import { readConfObject } from '@jbrowse/core/configuration'
import { SceneGraph } from '@jbrowse/core/util/layouts'

import { chooseGlyphType } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export interface LayOutArgs {
  layout: SceneGraph
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
}

/**
 * Positions a single feature in the scene graph
 */
export function layOutFeature(args: LayOutArgs) {
  const { layout, feature, bpPerPx, reversed, config } = args
  const displayMode = readConfObject(config, 'displayMode') as string
  const parentFeature = feature.parent()
  let x = 0
  if (parentFeature) {
    x =
      (reversed
        ? parentFeature.get('end') - feature.get('end')
        : feature.get('start') - parentFeature.get('start')) / bpPerPx
  }
  const height = readConfObject(config, 'height', { feature }) as number
  const width = (feature.get('end') - feature.get('start')) / bpPerPx
  const layoutParent = layout.parent
  const top = layoutParent ? layoutParent.top : 0
  return layout.addChild(
    feature.id(),
    x,
    displayMode === 'collapse' ? 0 : top,
    Math.max(width, 1),
    displayMode === 'compact' ? height / 2 : height,
    {},
  )
}

/**
 * Lays out multiple subfeatures within a parent feature
 */
export function layOutSubfeatures(
  args: LayOutArgs & { subfeatures: Feature[] },
) {
  const { layout, subfeatures, bpPerPx, reversed, config } = args
  for (const feature of subfeatures) {
    layOut({
      layout,
      feature,
      bpPerPx,
      reversed,
      config,
    })
  }
}

/**
 * Main layout function that positions a feature and its subfeatures
 */
export function layOut(args: LayOutArgs): SceneGraph {
  const { layout, feature, bpPerPx, reversed, config } = args
  const displayMode = readConfObject(config, 'displayMode')
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
  })
  if (displayMode !== 'reducedRepresentation') {
    layOutSubfeatures({
      layout: subLayout,
      subfeatures: feature.get('subfeatures') || [],
      bpPerPx,
      reversed,
      config,
    })
  }
  return subLayout
}

/**
 * Custom layout for ProcessedTranscript glyphs
 */
export function layOutProcessedTranscript(
  args: LayOutArgs & { subfeatures: Feature[] },
): SceneGraph {
  const { layout, feature, bpPerPx, reversed, config, subfeatures } = args
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
  })
  layOutSubfeatures({
    layout: subLayout,
    subfeatures,
    bpPerPx,
    reversed,
    config,
  })
  return subLayout
}

/**
 * Get the appropriate layout function for a feature
 */
export function getLayoutFunction(feature: Feature, config: AnyConfigurationModel) {
  const glyphType = chooseGlyphType({ feature, config })
  return glyphType === 'ProcessedTranscript' ? layOutProcessedTranscript : layOut
}
