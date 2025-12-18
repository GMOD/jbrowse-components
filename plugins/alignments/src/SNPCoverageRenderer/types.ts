import { type Feature, reducePrecision, toLocale } from '@jbrowse/core/util'

import type { CoverageBinsSoA } from '../SNPCoverageAdapter/generateCoverageBinsPrefixSum'
import type {
  BaseCoverageBin,
  ColorBy,
  ModificationTypeWithColor,
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

function truncateSequence(seq: string, maxLength = 20) {
  if (seq.length <= maxLength) {
    return { text: seq, truncated: false }
  }
  return { text: `${seq.slice(0, maxLength)}...`, truncated: true }
}

function formatStrandCounts(entry: { '1'?: number; '-1'?: number }) {
  const neg = entry['-1'] ? `${entry['-1']}(-)` : ''
  const pos = entry['1'] ? `${entry['1']}(+)` : ''
  return neg + pos || '-'
}

function formatStrandFromCounts(fwd?: number, rev?: number) {
  if (fwd === undefined && rev === undefined) {
    return ''
  }
  return `\nStrand: ${fwd ?? 0} fwd, ${rev ?? 0} rev`
}

function formatCountPct(count: number, total: number) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  return `${count}/${total} of reads (${pct}%)`
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
          ? `qual:${reducePrecision(entry.avgProbability, 1)}`
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
  let result = formatCountPct(count, total)
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

export function formatSNPStats(item: SNPItem) {
  const {
    base,
    count,
    total,
    refbase,
    avgQual,
    fwdCount,
    revCount,
    bin,
    start,
    end,
  } = item

  // If we have full bin data, show detailed tooltip matching the normal tooltip
  if (bin) {
    const { readsCounted, ref, snps, mods } = bin
    const pos =
      start === end - 1
        ? toLocale(start + 1)
        : `${toLocale(start + 1)}..${toLocale(end)}`

    let result = pos ? `Position: ${pos}\n` : ''
    result += `Total: ${readsCounted}\n`
    result += `REF${refbase ? ` (${refbase.toUpperCase()})` : ''}: ${ref.entryDepth} (${((ref.entryDepth / readsCounted) * 100).toFixed(1)}%) ${formatStrandCounts(ref)}\n`

    // Add SNPs
    for (const [snpBase, entry] of Object.entries(snps)) {
      const pctVal = ((entry.entryDepth / readsCounted) * 100).toFixed(1)
      result += `${snpBase}: ${entry.entryDepth} (${pctVal}%) ${formatStrandCounts(entry)}`
      if (entry.avgProbability !== undefined) {
        result += ` qual:${reducePrecision(entry.avgProbability, 1)}`
      }
      result += '\n'
    }

    // Add mods if present
    for (const [modKey, entry] of Object.entries(mods)) {
      const pctVal = ((entry.entryDepth / readsCounted) * 100).toFixed(1)
      result += `${modKey}: ${entry.entryDepth} (${pctVal}%) ${formatStrandCounts(entry)}`
      if (entry.avgProbability !== undefined) {
        result += ` prob:${(entry.avgProbability * 100).toFixed(1)}%`
      }
      result += '\n'
    }

    return result.trim()
  }

  // Fallback to simple format
  const mutation = refbase ? `${refbase}→${base}` : base
  let result = `${mutation}: ${formatCountPct(count, total)}`
  if (avgQual !== undefined) {
    result += `\nAvg quality: ${reducePrecision(avgQual, 1)}`
  }
  result += formatStrandFromCounts(fwdCount, revCount)
  return result
}

export function formatModificationStats(item: ModificationItem) {
  const {
    modType,
    base,
    count,
    total,
    avgProb,
    fwdCount,
    revCount,
    isUnmodified,
  } = item
  const label = isUnmodified ? `Unmodified ${base}` : `${modType} (${base})`
  let result = `${label}: ${formatCountPct(count, total)}`
  if (avgProb !== undefined) {
    result += `\nAvg probability: ${reducePrecision(avgProb * 100, 1)}%`
  }
  result += formatStrandFromCounts(fwdCount, revCount)
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

export interface RenderArgsDeserializedWithArrays extends RenderArgsDeserialized {
  featureArrays: CoverageBinsSoA
}

export type { CoverageBinsSoA as SNPCoverageArrays } from '../SNPCoverageAdapter/generateCoverageBinsPrefixSum'
