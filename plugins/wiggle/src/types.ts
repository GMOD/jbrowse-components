import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

import type { ScaleOpts, Source } from './util'

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  scaleOpts: ScaleOpts
  displayCrossHatches: boolean
  ticks: { values: number[] }
  inverted: boolean
  themeOptions: ThemeOptions
  statusCallback?: (arg: string) => void
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
}

export interface MultiRenderArgsDeserialized
  extends RenderArgsDeserializedWithFeatures {
  sources: Source[]
}
