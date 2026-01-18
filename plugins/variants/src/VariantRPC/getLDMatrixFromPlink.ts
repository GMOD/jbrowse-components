import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type {
  FilterStats,
  LDMatrixResult,
  LDMetric,
  RecombinationData,
} from './getLDMatrix.ts'
import type PlinkLDAdapter from '../PlinkLDAdapter/PlinkLDAdapter.ts'
import type { PlinkLDRecord } from '../PlinkLDAdapter/PlinkLDAdapter.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

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

  // Collect all LD records from all regions
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

  // Build unique SNP list from the records
  const snpMap = new Map<
    string,
    { id: string; refName: string; start: number; end: number }
  >()

  for (const record of allRecords) {
    const keyA = `${record.chrA}:${record.bpA}`
    if (!snpMap.has(keyA)) {
      snpMap.set(keyA, {
        id: record.snpA,
        refName: record.chrA,
        start: record.bpA,
        end: record.bpA + 1,
      })
    }
    const keyB = `${record.chrB}:${record.bpB}`
    if (!snpMap.has(keyB)) {
      snpMap.set(keyB, {
        id: record.snpB,
        refName: record.chrB,
        start: record.bpB,
        end: record.bpB + 1,
      })
    }
  }

  // Sort SNPs by position
  const snps = [...snpMap.values()].sort((a, b) => {
    if (a.refName !== b.refName) {
      return a.refName.localeCompare(b.refName)
    }
    return a.start - b.start
  })

  // Create position to index mapping
  const snpToIndex = new Map<string, number>()
  for (const [idx, snp] of snps.entries()) {
    snpToIndex.set(`${snp.refName}:${snp.start}`, idx)
  }

  // Build lower triangular LD matrix
  const n = snps.length
  const ldSize = (n * (n - 1)) / 2
  const ldValues = new Float32Array(ldSize)
  // Initialize with NaN to detect missing pairs
  ldValues.fill(Number.NaN)

  // Helper to get index in lower triangular matrix
  // For pair (i, j) where i > j: index = i*(i-1)/2 + j
  const getLowerTriIndex = (i: number, j: number) => {
    if (i <= j) {
      // Swap to ensure i > j
      ;[i, j] = [j, i]
    }
    return (i * (i - 1)) / 2 + j
  }

  // Fill in LD values from records
  for (const record of allRecords) {
    const keyA = `${record.chrA}:${record.bpA}`
    const keyB = `${record.chrB}:${record.bpB}`
    const idxA = snpToIndex.get(keyA)
    const idxB = snpToIndex.get(keyB)

    if (idxA !== undefined && idxB !== undefined && idxA !== idxB) {
      const matrixIdx = getLowerTriIndex(idxA, idxB)
      const value =
        ldMetric === 'dprime' ? (record.dprime ?? record.r2) : record.r2
      ldValues[matrixIdx] = value
    }
  }

  // Replace NaN with 0 for missing pairs
  for (let i = 0; i < ldValues.length; i++) {
    if (Number.isNaN(ldValues[i])) {
      ldValues[i] = 0
    }
  }

  // Calculate recombination (1 - r²) between adjacent SNPs
  const recombValues = new Float32Array(Math.max(0, n - 1))
  const recombPositions: number[] = []

  for (let i = 0; i < n - 1; i++) {
    const snp1 = snps[i]!
    const snp2 = snps[i + 1]!

    // Look up the LD value between adjacent SNPs
    const matrixIdx = getLowerTriIndex(i + 1, i)
    const r2 = ldValues[matrixIdx] ?? 0

    recombValues[i] = 1 - r2
    recombPositions.push((snp1.start + snp2.start) / 2)
  }

  const recombination: RecombinationData = {
    values: recombValues,
    positions: recombPositions,
  }

  // For pre-computed LD, we don't have filtering stats
  const filterStats: FilterStats = {
    totalVariants: snps.length,
    passedVariants: snps.length,
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
    recombination,
  }
}
