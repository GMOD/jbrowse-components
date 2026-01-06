import type {
  ColorBy,
  ModificationTypeWithColor,
  SortedBy,
} from '../shared/types.ts'
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
  | {
      type: 'modification'
      info: string
      modType: string
      probability: number
      start: number
      mismatch?: string
    }

const LARGE_INSERTION_THRESHOLD = 10

export function getFlatbushItemLabel(item: FlatbushItem): string {
  switch (item.type) {
    case 'insertion':
      return item.sequence.length > LARGE_INSERTION_THRESHOLD
        ? `${item.sequence.length}bp insertion (click to see)`
        : `Insertion: ${item.sequence}`
    case 'deletion':
      return `Deletion: ${item.length}bp`
    case 'softclip':
      return `Soft clip: ${item.length}bp`
    case 'hardclip':
      return `Hard clip: ${item.length}bp`
    case 'modification': {
      const mismatchInfo = item.mismatch ? `\nMismatch: ${item.mismatch}` : ''
      return item.info + mismatchInfo
    }
    case 'mismatch':
      return `Mismatch: ${item.base}`
  }
}

export function flatbushItemToFeatureData(
  item: FlatbushItem,
  refName: string,
  sourceRead?: string,
): Record<string, unknown> {
  const base = {
    uniqueId: `${item.type}-${item.start}`,
    type: item.type,
    refName,
    sourceRead,
  }
  switch (item.type) {
    case 'insertion':
      return {
        ...base,
        start: item.start,
        end: item.start + 1,
        sequence: item.sequence,
        insertionLength: item.sequence.length,
      }
    case 'deletion':
      return {
        ...base,
        start: item.start,
        end: item.start + item.length,
      }
    case 'softclip':
    case 'hardclip':
      return {
        ...base,
        start: item.start,
        end: item.start + 1,
        clipLength: item.length,
      }
    case 'modification':
      return {
        ...base,
        start: item.start,
        end: item.start + 1,
        info: item.info,
        modType: item.modType,
        probability: item.probability.toFixed(3),
        ...(item.mismatch ? { mismatch: item.mismatch } : {}),
      }
    case 'mismatch':
      return {
        ...base,
        start: item.start,
        end: item.start + 1,
        base: item.base,
      }
  }
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
