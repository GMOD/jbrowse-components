import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type {
  FilterStats,
  LDMatrixResult,
  LDMetric,
  LDSnp,
  RecombinationData,
} from './getLDMatrix.ts'
import type PlinkLDAdapter from '../PlinkLDAdapter/PlinkLDAdapter.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

// Identity of a SNP is its (refName, position); PLINK LD records reference the
// same SNP from many rows, so this key deduplicates and indexes them.
function snpKey(refName: string, pos: number) {
  return `${refName}:${pos}`
}

// Row-major index into a lower-triangular matrix (diagonal excluded) for the
// unordered pair {i, j}, i ≠ j. The larger index is the row, so the cell lives
// at row*(row-1)/2 + col.
function lowerTriIndex(i: number, j: number) {
  const row = Math.max(i, j)
  const col = Math.min(i, j)
  return (row * (row - 1)) / 2 + col
}

function finiteOrZero(v: number | undefined) {
  return v !== undefined && Number.isFinite(v) ? v : 0
}

// The value painted into a cell for the chosen metric. D' can be absent in the
// file (falls back to r²) or unparseable (finiteOrZero keeps the matrix finite
// so rendering never branches on NaN).
function metricValue(record: PlinkLDRecord, ldMetric: LDMetric) {
  return finiteOrZero(
    ldMetric === 'dprime' ? (record.dprime ?? record.r2) : record.r2,
  )
}

// Deduplicate both endpoints of every record into a unique SNP list sorted by
// (refName, position). Sorted order defines the matrix row/column index.
function collectSortedSnps(records: PlinkLDRecord[]): LDSnp[] {
  const snpMap = new Map<string, LDSnp>()
  const add = (refName: string, pos: number, id: string) => {
    const key = snpKey(refName, pos)
    if (!snpMap.has(key)) {
      snpMap.set(key, { id, refName, start: pos, end: pos + 1 })
    }
  }
  for (const r of records) {
    add(r.chrA, r.bpA, r.snpA)
    add(r.chrB, r.bpB, r.snpB)
  }
  return [...snpMap.values()].sort((a, b) =>
    a.refName === b.refName
      ? a.start - b.start
      : a.refName.localeCompare(b.refName),
  )
}

// Recombination evidence (1 - r²) plotted at the midpoint between each pair of
// adjacent SNPs. Always r²-based, independent of the displayed metric.
function buildRecombination(
  snps: LDSnp[],
  adjacentR2: Float32Array,
): RecombinationData {
  const values = new Float32Array(adjacentR2.length)
  const positions: number[] = []
  for (let i = 0; i < adjacentR2.length; i++) {
    values[i] = 1 - adjacentR2[i]!
    positions.push((snps[i]!.start + snps[i + 1]!.start) / 2)
  }
  return { values, positions }
}

export async function getLDMatrixFromPlink({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: AnyConfigurationModel
    stopToken?: StopToken
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    ldMetric?: LDMetric
  }
}): Promise<LDMatrixResult> {
  const { regions, adapterConfig, sessionId, ldMetric = 'r2' } = args

  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as PlinkLDAdapter

  const allRecords: PlinkLDRecord[] = []
  for (const region of regions) {
    const records = await dataAdapter.getLDRecordsInRegion({
      refName: region.refName,
      start: region.start,
      end: region.end,
    })
    for (const r of records) {
      allRecords.push(r)
    }
  }

  const snps = collectSortedSnps(allRecords)
  const n = snps.length
  const indexByKey = new Map<string, number>()
  for (const [idx, snp] of snps.entries()) {
    indexByKey.set(snpKey(snp.refName, snp.start), idx)
  }

  // Lower-triangular LD matrix. A fresh Float32Array is zero-filled, so pairs
  // never named in the records stay 0 (no LD) with no extra bookkeeping.
  const ldValues = new Float32Array((n * (n - 1)) / 2)

  // r² of each adjacent pair (i, i+1). Captured separately from ldValues, which
  // holds D' when ldMetric === 'dprime', because recombination is always 1 - r².
  const adjacentR2 = new Float32Array(Math.max(0, n - 1))

  for (const record of allRecords) {
    const i = indexByKey.get(snpKey(record.chrA, record.bpA))
    const j = indexByKey.get(snpKey(record.chrB, record.bpB))
    if (i !== undefined && j !== undefined && i !== j) {
      ldValues[lowerTriIndex(i, j)] = metricValue(record, ldMetric)
      if (Math.abs(i - j) === 1) {
        adjacentR2[Math.min(i, j)] = finiteOrZero(record.r2)
      }
    }
  }

  // Pre-computed LD has no per-variant genotypes, so nothing is filtered.
  const filterStats: FilterStats = {
    filteredByCallRate: 0,
    totalVariants: n,
    passedVariants: n,
    filteredByMaf: 0,
    filteredByLength: 0,
    filteredByMultiallelic: 0,
    filteredByHwe: 0,
  }

  return {
    snps,
    ldValues,
    metric: ldMetric,
    filterStats,
    recombination: buildRecombination(snps, adjacentR2),
  }
}
