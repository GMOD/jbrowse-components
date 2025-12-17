import { type Feature, reducePrecision, toLocale } from '@jbrowse/core/util'

import type {
  BaseCoverageBin,
  ColorBy,
  ModificationTypeWithColor,
  SkipMap,
} from '../shared/types'
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
  topSequence?: string
}

const typeLabels: Record<string, string> = {
  insertion: 'Insertion',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
}

export function getInterbaseTypeLabel(type: string) {
  return typeLabels[type] ?? type
}

function truncateSequence(seq: string, maxLength = 20) {
  if (seq.length <= maxLength) {
    return { text: seq, truncated: false }
  }
  return { text: `${seq.slice(0, maxLength)}...`, truncated: true }
}

export function formatInterbaseStats(
  count: number,
  total: number,
  type: 'insertion' | 'softclip' | 'hardclip',
  lengthStats?: {
    avgLength?: number
    minLength?: number
    maxLength?: number
    topSequence?: string
  },
) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  let result = `${count}/${total} (${pct}% of reads)`
  if (lengthStats?.avgLength !== undefined) {
    const { avgLength, minLength, maxLength, topSequence } = lengthStats
    const avgStr = reducePrecision(avgLength, 1)
    if (minLength !== undefined && maxLength !== undefined) {
      if (minLength === maxLength) {
        if (topSequence !== undefined) {
          const { text, truncated } = truncateSequence(topSequence)
          result += `\n${text} (${toLocale(minLength)}bp ${type})`
          if (truncated) {
            result += '\nClick to see full sequence'
          }
        } else {
          result += `\n${toLocale(minLength)}bp ${type}`
        }
      } else {
        result += `\n${toLocale(minLength)}bp - ${toLocale(maxLength)}bp ${type} (avg ${avgStr}bp)`
        if (topSequence !== undefined) {
          const { text, truncated } = truncateSequence(topSequence)
          result += `\nMost common: ${text}`
          if (truncated) {
            result += '\nClick to see full sequence'
          }
        }
      }
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

// Structure-of-arrays format for efficient rendering
export interface SNPCoverageArrays {
  starts: Int32Array
  ends: Int32Array
  scores: Float32Array
  snpinfo: BaseCoverageBin[]
  skipmap: SkipMap
}

export interface RenderArgsDeserializedWithArrays extends RenderArgsDeserialized {
  featureArrays: SNPCoverageArrays
}
