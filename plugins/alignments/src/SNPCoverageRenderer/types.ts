import type { ColorBy, ModificationTypeWithColor } from '../shared/types'
import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ScaleOpts } from '@jbrowse/plugin-wiggle'

export interface InterbaseIndicatorItem {
  type: 'insertion' | 'softclip' | 'hardclip'
  base: string
  count: number
  total: number
}

const typeLabels: Record<string, string> = {
  insertion: 'Insertion',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
}

export function getInterbaseTypeLabel(type: string) {
  return typeLabels[type] ?? type
}

export function formatInterbaseStats(count: number, total: number) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  return `${count}/${total} (${pct}%)`
}

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  scaleOpts: ScaleOpts
  ticks: { values: number[] }
  displayCrossHatches: boolean
  visibleModifications?: Record<string, ModificationTypeWithColor>
  simplexModifications?: string[]
  colorBy: ColorBy
  statusCallback?: (arg: string) => void
}

export interface RenderArgsDeserializedWithFeatures extends RenderArgsDeserialized {
  features: Map<string, Feature>
}
