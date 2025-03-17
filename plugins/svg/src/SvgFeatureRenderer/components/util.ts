import { readConfObject } from '@jbrowse/core/configuration'

import Box from './Box'
import { chooseGlyphComponent } from './chooseGlyphComponent'

import type { FeatureLayOutArgs, SubfeatureLayOutArgs } from './types'
import type { Feature } from '@jbrowse/core/util'
import type SceneGraph from '@jbrowse/core/util/layouts/SceneGraph'

export function layOut({
  layout,
  feature,
  bpPerPx,
  reversed,
  config,
  extraGlyphs,
}: FeatureLayOutArgs): SceneGraph {
  const displayMode = readConfObject(config, 'displayMode')
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  if (displayMode !== 'reducedRepresentation') {
    layOutSubfeatures({
      layout: subLayout,
      subfeatures: feature.get('subfeatures') || [],
      bpPerPx,
      reversed,
      config,
      extraGlyphs,
    })
  }
  return subLayout
}

export function layOutFeature(args: FeatureLayOutArgs) {
  const { layout, feature, bpPerPx, reversed, config, extraGlyphs } = args
  const displayMode = readConfObject(config, 'displayMode') as string
  const GlyphComponent =
    displayMode === 'reducedRepresentation'
      ? Box
      : chooseGlyphComponent({
          feature,
          extraGlyphs,
          config,
        })
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
    String(feature.id()),
    x,
    displayMode === 'collapse' ? 0 : top,
    Math.max(width, 1), // has to be at least one to register in the layout
    displayMode === 'compact' ? height / 2 : height,
    { GlyphComponent },
  )
}

export function layOutSubfeatures(args: SubfeatureLayOutArgs) {
  const { layout, subfeatures, bpPerPx, reversed, config, extraGlyphs } = args
  for (const feature of subfeatures) {
    ;(chooseGlyphComponent({ feature, extraGlyphs, config }).layOut || layOut)({
      layout,
      feature,
      bpPerPx,
      reversed,
      config,
      extraGlyphs,
    })
  }
}

export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/i.test(
    feature.get('type') || '',
  )
}
