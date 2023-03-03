import React from 'react'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import SceneGraph from '@jbrowse/core/util/layouts/SceneGraph'
import { Feature, Region } from '@jbrowse/core/util'

// locals
import Box from './Box'
import ProcessedTranscript from './ProcessedTranscript'
import Segments from './Segments'
import Subfeatures from './Subfeatures'

export interface Glyph
  extends React.FC<{
    children: React.ReactNode
    feature: Feature
    featureLayout: SceneGraph
    selected?: boolean
    config: AnyConfigurationModel
    region: Region
    bpPerPx: number
    topLevel?: boolean
    [key: string]: unknown
  }> {
  layOut?: Function
}

type LayoutRecord = [number, number, number, number]

export interface DisplayModel {
  getFeatureByID?: (arg0: string, arg1: string) => LayoutRecord
  getFeatureOverlapping?: (
    blockKey: string,
    bp: number,
    y: number,
  ) => string | undefined
  selectedFeatureId?: string
  featureIdUnderMouse?: string
  contextMenuFeature?: Feature
}

export interface ExtraGlyphValidator {
  glyph: Glyph
  validator: (feature: Feature) => boolean
}

export function chooseGlyphComponent(
  feature: Feature,
  extraGlyphs?: ExtraGlyphValidator[],
): Glyph {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')

  if (subfeatures && type !== 'CDS') {
    const hasSubSub = subfeatures.find(sub => !!sub.get('subfeatures'))
    if (
      ['mRNA', 'transcript', 'primary_transcript'].includes(type) &&
      subfeatures.some(f => f.get('type') === 'CDS')
    ) {
      return ProcessedTranscript
    } else if (!feature.parent() && hasSubSub) {
      // only do sub-sub on parent level features like gene
      return Subfeatures
    } else {
      return Segments
    }
  }

  return extraGlyphs?.find(f => f.validator(feature))?.glyph || Box
}

interface BaseLayOutArgs {
  layout: SceneGraph
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
}

interface FeatureLayOutArgs extends BaseLayOutArgs {
  feature: Feature
  extraGlyphs: ExtraGlyphValidator[]
}

interface SubfeatureLayOutArgs extends BaseLayOutArgs {
  subfeatures: Feature[]
  extraGlyphs: ExtraGlyphValidator[]
}

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

export function layOutFeature(args: FeatureLayOutArgs): SceneGraph {
  const { layout, feature, bpPerPx, reversed, config, extraGlyphs } = args
  const displayMode = readConfObject(config, 'displayMode') as string
  const GlyphComponent =
    displayMode === 'reducedRepresentation'
      ? Box
      : chooseGlyphComponent(feature, extraGlyphs)
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
  const subLayout = layout.addChild(
    String(feature.id()),
    x,
    displayMode === 'collapse' ? 0 : top,
    Math.max(width, 1), // has to be at least one to register in the layout
    displayMode === 'compact' ? height / 2 : height,
    { GlyphComponent },
  )
  return subLayout
}

export function layOutSubfeatures(args: SubfeatureLayOutArgs) {
  const { layout, subfeatures, bpPerPx, reversed, config, extraGlyphs } = args
  subfeatures.forEach(feature => {
    ;(chooseGlyphComponent(feature, extraGlyphs).layOut || layOut)({
      layout,
      feature,
      bpPerPx,
      reversed,
      config,
      extraGlyphs,
    })
  })
}

export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
    feature.get('type') || '',
  )
}
