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

export type FlatbushItem =
  | { type: 'mismatch'; base: string; start: number }
  | { type: 'insertion'; sequence: string; start: number }
  | { type: 'deletion'; length: number; start: number }
  | { type: 'softclip'; length: number; start: number }
  | { type: 'hardclip'; length: number; start: number }
  | { type: 'modification'; info: string; modType: string; probability: number; start: number }

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
