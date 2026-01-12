import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'

export interface Source {
  baseUri?: string
  name: string
  baseName?: string
  label?: string
  color?: string
  group?: string
  HP?: number
  id?: string
  [key: string]: unknown
}

export interface SampleInfo {
  isPhased: boolean
  maxPloidy: number
}

export interface MultiVariantRenderArgsBase extends FeatureRenderArgsDeserialized {
  sources: Source[]
  bpPerPx: number
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  height: number
  rowHeight: number
  scrollTop: number
  features: Map<string, Feature>
  renderingMode: string
  statusCallback?: (arg: string) => void
  highResolutionScaling: number
}
