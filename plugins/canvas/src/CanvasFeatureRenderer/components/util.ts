import { readConfObject } from '@jbrowse/core/configuration'

import Box from './Box'
import ProcessedTranscript from './ProcessedTranscript'
import Segments from './Segments'
import Subfeatures from './Subfeatures'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

export interface Glyph {
  draw: (props: {
    colorByCDS: boolean
    feature: Feature
    // Removed featureLayout: SceneGraph
    x: number
    y: number
    width: number
    height: number
    selected?: boolean
    config: AnyConfigurationModel
    region: Region
    bpPerPx: number
    topLevel?: boolean
    ctx: CanvasRenderingContext2D
  }) => void
  getHeight: (args: {
    feature: Feature
    config: AnyConfigurationModel
  }) => number
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

export function chooseGlyphComponent({
  feature,
  config,
}: {
  feature: Feature
  config: AnyConfigurationModel
}): Glyph {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')
  const transcriptTypes = readConfObject(config, 'transcriptTypes')
  const containerTypes = readConfObject(config, 'containerTypes')

  if (subfeatures?.length && type !== 'CDS') {
    const hasSubSub = subfeatures.some(f => f.get('subfeatures')?.length)
    const hasCDS = subfeatures.some(f => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return ProcessedTranscript
    } else if (
      (!feature.parent() && hasSubSub) ||
      containerTypes.includes(type)
    ) {
      return Subfeatures
    } else {
      return Segments
    }
  } else {
    return Box
  }
}



export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/i.test(
    feature.get('type') || '',
  )
}