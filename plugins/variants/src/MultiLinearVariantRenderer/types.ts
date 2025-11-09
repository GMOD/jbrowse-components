import type { Source } from '../shared/types'
import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  themeOptions: ThemeOptions
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
}

export interface MultiRenderArgsDeserialized
  extends RenderArgsDeserializedWithFeatures {
  sources: Source[]
  rowHeight: number
  scrollTop: number
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  statusCallback?: (arg: string) => void
}
