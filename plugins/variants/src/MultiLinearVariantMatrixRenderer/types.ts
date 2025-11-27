import type { Source } from '../shared/types'
import type { RenderArgsDeserialized as BoxRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  sources: Source[]
  minorAlleleFrequencyFilter: number
  highResolutionScaling: number
  height: number
  rowHeight: number
  scrollTop: number
  features: Map<string, Feature>
  renderingMode: string
  statusCallback?: (arg: string) => void
  lengthCutoffFilter: number
  stopToken: string
}
