import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { isLDRecordSource } from '@jbrowse/ld-core'

import { bandCellCount, bandPairIndex, resolveBand } from './ldBand.ts'

import type {
  FilterStats,
  LDMatrixResult,
  LDMetric,
  LDSnp,
} from './getLDMatrix.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

// Identity of a SNP is its (refName, position); PLINK LD records reference the
// same SNP from many rows, so this key deduplicates and indexes them.
function snpKey(refName: string, pos: number) {
  return `${refName}:${pos}`
}

function finiteOrZero(v: number | undefined) {
  return v !== undefined && Number.isFinite(v) ? v : 0
}

// The value painted into a cell for the chosen metric. D' can be absent in the
// file (falls back to r²) or unparsable (finiteOrZero keeps the matrix finite
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

export async function getLDMatrixFromPlink({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: Record<string, unknown>
    stopToken?: StopToken
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    ldMetric?: LDMetric
    maxVariantSeparation?: number
  }
}): Promise<LDMatrixResult> {
  const {
    regions,
    adapterConfig,
    sessionId,
    ldMetric = 'r2',
    maxVariantSeparation = 0,
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  if (!isLDRecordSource(dataAdapter)) {
    throw new Error(
      `Adapter type "${adapterConfig.type}" cannot supply pre-computed LD records`,
    )
  }

  // D' is only present if the file has a DP column. Without it, a 'dprime'
  // request must fall back to r² rather than mislabel r² as D' in the legend.
  const hasDprime = (await dataAdapter.getHeader()).dprimeIdx >= 0
  const metric: LDMetric = ldMetric === 'dprime' && !hasDprime ? 'r2' : ldMetric

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

  // Banded LD matrix. A fresh Float32Array is zero-filled, so pairs never named
  // in the records stay 0 (no LD) with no extra bookkeeping — and a record for
  // a pair outside the band is dropped the same way, since the band says that
  // pair is not shown. A pre-computed file is usually already windowed (it is
  // plink's default output), so this most often drops nothing.
  const band = resolveBand(n, maxVariantSeparation)
  const ldValues = new Float32Array(bandCellCount(n, band))

  for (const record of allRecords) {
    const i = indexByKey.get(snpKey(record.chrA, record.bpA))
    const j = indexByKey.get(snpKey(record.chrB, record.bpB))
    if (i !== undefined && j !== undefined && i !== j) {
      const slot = bandPairIndex(i, j, band)
      if (slot >= 0) {
        ldValues[slot] = metricValue(record, metric)
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
    filteredByJexl: 0,
  }

  return {
    snps,
    ldValues,
    metric,
    hasDprime,
    method: 'precomputed',
    band,
    filterStats,
  }
}
