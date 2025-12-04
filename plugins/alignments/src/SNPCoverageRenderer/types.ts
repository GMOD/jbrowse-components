import { type Feature, reducePrecision, toLocale } from '@jbrowse/core/util'

import type { ColorBy, ModificationTypeWithColor } from '../shared/types'
import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { ScaleOpts } from '@jbrowse/plugin-wiggle'

export interface InterbaseIndicatorItem {
  type: 'insertion' | 'softclip' | 'hardclip'
  base: string
  count: number
  total: number
  avgLength?: number
  minLength?: number
  maxLength?: number
}

const typeLabels: Record<string, string> = {
  insertion: 'Insertion',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
}

export function getInterbaseTypeLabel(type: string) {
  return typeLabels[type] ?? type
}

export function formatInterbaseStats(
  count: number,
  total: number,
  lengthStats?: { avgLength?: number; minLength?: number; maxLength?: number },
) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  let result = `${count}/${total} (${pct}% of reads)`
  if (lengthStats?.avgLength !== undefined) {
    const { avgLength, minLength, maxLength } = lengthStats
    const avgStr = reducePrecision(avgLength, 1)
    if (minLength !== undefined && maxLength !== undefined) {
      result +=
        minLength === maxLength
          ? `\nLength: ${toLocale(minLength)}bp`
          : `\nLength: ${toLocale(minLength)}bp - ${toLocale(maxLength)}bp (avg ${avgStr}bp)`
    } else {
      result += `\nAvg length: ${avgStr}bp`
    }
  }
  return result
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
  offset?: number
}

export interface RenderArgsDeserializedWithFeatures extends RenderArgsDeserialized {
  features: Map<string, Feature>
}
