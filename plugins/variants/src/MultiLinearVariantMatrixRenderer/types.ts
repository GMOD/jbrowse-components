import type { Source } from '../types'
import type { RenderArgsDeserialized as BoxRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  sources: Source[]
  minorAlleleFrequencyFilter: number
  highResolutionScaling: number
  height: number
  phasedMode: string
}

export interface RenderArgsDeserializedWithFeaturesAndLayout
  extends RenderArgsDeserialized {
  sources: Source[]
  features: Map<string, Feature>
  phasedMode: string
}
