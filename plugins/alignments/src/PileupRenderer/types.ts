import type {
  ColorBy,
  ModificationTypeWithColor,
  SortedBy,
} from '../shared/types'
import type { RenderArgsDeserialized as BoxRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'

export interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
}

export interface FlatbushItem {
  type:
    | 'insertion'
    | 'deletion'
    | 'mismatch'
    | 'modification'
    | 'softclip'
    | 'hardclip'
  seq: string
  modType?: string
  probability?: number
}

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  colorBy?: ColorBy
  colorTagMap?: Record<string, string>
  visibleModifications?: Record<string, ModificationTypeWithColor>
  sortedBy?: SortedBy
  showSoftClip: boolean
  highResolutionScaling: number
  statusCallback?: (arg: string) => void
}

export interface ProcessedRenderArgs extends RenderArgsDeserialized {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
  regionSequence: string | undefined
}

export interface PreProcessedRenderArgs extends RenderArgsDeserialized {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
}
