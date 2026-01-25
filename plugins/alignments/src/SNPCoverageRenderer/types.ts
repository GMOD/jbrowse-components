import { reducePrecision } from '@jbrowse/core/util'

import type {
  BaseCoverageBin,
  ColorBy,
  ModificationTypeWithColor,
} from '../shared/types.ts'
import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature, LastStopTokenCheck } from '@jbrowse/core/util'
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
  start: number
}

export interface SNPItem {
  type: 'snp'
  base: string
  count: number
  total: number
  refbase?: string
  avgQual?: number
  fwdCount: number
  revCount: number
  bin?: BaseCoverageBin
  start: number
  end: number
}

export interface ModificationItem {
  type: 'modification'
  modType: string
  base: string
  count: number
  total: number
  avgProb?: number
  fwdCount: number
  revCount: number
  isUnmodified: boolean
  start: number
}

export type ClickMapItem = InterbaseIndicatorItem | SNPItem | ModificationItem

const typeLabels: Record<string, string> = {
  insertion: 'Insertion',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
  snp: 'SNP',
  modification: 'Modification',
}

export function getInterbaseTypeLabel(type: string) {
  return typeLabels[type] ?? type
}

function formatStrandCounts(entry: { '1'?: number; '-1'?: number }) {
  const neg = entry['-1'] ? `${entry['-1']}(-)` : ''
  const pos = entry['1'] ? `${entry['1']}(+)` : ''
  return neg + pos || '-'
}

function pct(n: number, total = 1) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

interface TableRow {
  base: string
  count: number
  percent: string
  strands: string
  prob?: string
}

export function formatBinAsTableRows(bin: BaseCoverageBin) {
  const { readsCounted, ref, refbase, snps, mods } = bin
  const rows: TableRow[] = [
    {
      base: 'Total',
      count: readsCounted,
      percent: '-',
      strands: '-',
    },
    {
      base: refbase ? `REF (${refbase.toUpperCase()})` : 'REF',
      count: ref.entryDepth,
      percent: pct(ref.entryDepth, readsCounted),
      strands: formatStrandCounts(ref),
    },
  ]

  for (const [snpBase, entry] of Object.entries(snps)) {
    rows.push({
      base: snpBase.toUpperCase(),
      count: entry.entryDepth,
      percent: pct(entry.entryDepth, readsCounted),
      strands: formatStrandCounts(entry),
      prob:
        entry.avgProbability !== undefined
          ? `qual:${reducePrecision(entry.avgProbability)}`
          : undefined,
    })
  }

  for (const [modKey, entry] of Object.entries(mods)) {
    rows.push({
      base: modKey,
      count: entry.entryDepth,
      percent: pct(entry.entryDepth, readsCounted),
      strands: formatStrandCounts(entry),
      prob:
        entry.avgProbability !== undefined
          ? `${(entry.avgProbability * 100).toFixed(1)}%`
          : undefined,
    })
  }

  return rows
}

export function clickMapItemToFeatureData(
  item: ClickMapItem,
  refName?: string,
): Record<string, unknown> {
  if (item.type === 'snp') {
    return {
      uniqueId: `snp-${item.base}-${item.start}`,
      type: 'snp',
      refName,
      start: item.start,
      end: item.end,
      details: item.bin ? formatBinAsTableRows(item.bin) : undefined,
    }
  }
  if (item.type === 'modification') {
    const pctVal =
      item.total > 0 ? ((item.count / item.total) * 100).toFixed(1) : '0'
    const label = item.isUnmodified
      ? `Unmodified ${item.base}`
      : `${item.modType} (${item.base})`
    return {
      uniqueId: `mod-${item.modType}-${item.base}`,
      type: 'modification',
      refName,
      start: item.start,
      end: item.start + 1,
      label,
      count: `${item.count}/${item.total} (${pctVal}%)`,
      strands: `${item.fwdCount}(+) ${item.revCount}(-)`,
      probability:
        item.avgProb !== undefined
          ? `${(item.avgProb * 100).toFixed(1)}%`
          : undefined,
    }
  }
  // interbase indicators (insertion, softclip, hardclip)
  const pctVal =
    item.total > 0 ? ((item.count / item.total) * 100).toFixed(1) : '0'
  return {
    uniqueId: `${item.type}-${item.base}`,
    type: item.type,
    refName,
    start: item.start,
    end: item.start + 1,
    count: `${item.count}/${item.total} (${pctVal}%)`,
    size:
      item.minLength === item.maxLength
        ? `${item.minLength}bp`
        : `${item.minLength}-${item.maxLength}bp (avg ${item.avgLength?.toFixed(1)}bp)`,
    sequence: item.topSequence,
  }
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

export interface SecondPassContext {
  ctx: CanvasRenderingContext2D
  coverageFeatures: Feature[]
  region: { start: number; end: number; refName: string; reversed?: boolean }
  bpPerPx: number
  colorMap: Record<string, string>
  toY: (n: number) => number
  toHeight: (n: number) => number
  toHeight2: (n: number) => number
  stopTokenCheck?: LastStopTokenCheck
  extraHorizontallyFlippedOffset: number
  coords: number[]
  items: ClickMapItem[]
  indicatorThreshold: number
  showInterbaseCounts: boolean
  showInterbaseIndicators: boolean
}

export interface SecondPassStats {
  snpDrawn: number
  snpSkipped: number
}

export interface StrandCounts {
  readonly entryDepth: number
  readonly '1': number
  readonly '-1': number
  readonly '0': number
}

export interface ModificationCountsParams {
  readonly base: string
  readonly isSimplex: boolean
  readonly refbase: string | undefined
  readonly snps: Readonly<Record<string, Partial<StrandCounts>>>
  readonly ref: StrandCounts
  readonly score0: number
}

export interface ModificationCountsResult {
  readonly modifiable: number
  readonly detectable: number
}

export interface ReducedFeature {
  start: number
  end: number
  score: number
  snpinfo: BaseCoverageBin
  refName: string
}

export interface SkipFeatureSerialized {
  uniqueId: string
  type: 'skip'
  refName: string
  start: number
  end: number
  strand: number
  score: number
  effectiveStrand: number
}
