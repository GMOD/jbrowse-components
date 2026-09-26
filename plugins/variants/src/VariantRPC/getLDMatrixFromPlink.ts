import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LD_NOT_COMPUTED, isLDRecordSource } from '@jbrowse/ld-core'

import { bandCellCount, bandPairIndex, resolveBand } from './ldBand.ts'

import type { LDMatrixResult, LDMetric, LDSnp } from './ldTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

// PLINK LD records name the same SNP from many rows, so (refName, BP)
// deduplicates and indexes them.
function snpKey(refName: string, bp: number) {
  return `${refName}:${bp}`
}

function metricValue(record: PlinkLDRecord, ldMetric: LDMetric) {
  const v = ldMetric === 'dprime' ? record.dprime : record.r2
  return v !== undefined && Number.isFinite(v) ? v : LD_NOT_COMPUTED
}

/**
 * The metric the file can actually serve, given what was asked for.
 *
 * Both directions matter and only one of them used to. A `--r2 dprime` emit
 * carries DP and no R2, and `parsePlinkLDLine` reported a missing r² as 0 —
 * so an r² request against such a file painted every pair at the ramp's floor
 * with nothing anywhere saying so. `parsePlinkLDHeader` accepts the file (it
 * requires only *one* of the two columns), so this is where the mismatch has
 * to be caught.
 */
function resolveMetric(
  ldMetric: LDMetric,
  { hasR2, hasDprime }: { hasR2: boolean; hasDprime: boolean },
): LDMetric {
  if (ldMetric === 'dprime') {
    return hasDprime ? 'dprime' : 'r2'
  }
  return hasR2 ? 'r2' : 'dprime'
}

// Deduplicate both endpoints of every record into a unique SNP list sorted by
// (refName, position). Sorted order defines the matrix row/column index.
//
// `maf` rides along from the file's MAF_A/MAF_B columns when it has them
// (plink's `--r2 with-freqs`, plink2's NONMAJ_FREQ_*), which the tooltip prints.
// `parsePlinkLDLine` has always read those columns; nothing collected them.
function collectSortedSnps(records: PlinkLDRecord[]): LDSnp[] {
  const snpMap = new Map<string, LDSnp>()
  const add = (refName: string, bp: number, id: string, maf?: number) => {
    const key = snpKey(refName, bp)
    if (!snpMap.has(key)) {
      snpMap.set(key, {
        id,
        refName,
        start: bp - 1,
        end: bp,
        maf: maf !== undefined && Number.isFinite(maf) ? maf : undefined,
      })
    }
  }
  for (const r of records) {
    add(r.chrA, r.bpA, r.snpA, r.mafA)
    add(r.chrB, r.bpB, r.snpB, r.mafB)
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
    signal?: AbortSignal
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

  // Which columns the file actually has: a request for a metric it does not
  // carry is downgraded rather than mislabeled in the legend, and both flags
  // ride back so the display can disable the radio for the missing one.
  const header = await dataAdapter.getHeader(args)
  const hasR2 = header.r2Idx >= 0
  const hasDprime = header.dprimeIdx >= 0
  const metric = resolveMetric(ldMetric, { hasR2, hasDprime })

  const allRecords: PlinkLDRecord[] = []
  for (const region of regions) {
    const records = await dataAdapter.getLDRecordsInRegion(
      { refName: region.refName, start: region.start, end: region.end },
      args,
    )
    for (const r of records) {
      allRecords.push(r)
    }
  }

  const snps = collectSortedSnps(allRecords)
  const n = snps.length
  const indexByKey = new Map<string, number>()
  for (const [idx, snp] of snps.entries()) {
    indexByKey.set(snpKey(snp.refName, snp.end), idx)
  }

  // A pair the file does not list was never measured: plink's default
  // `--ld-window-r2 0.2` and `--ld-window` leave most pairs out, and a D' for
  // one of them is no more 0 than it is 1.
  const band = resolveBand(n, maxVariantSeparation)
  const ldValues = new Float32Array(bandCellCount(n, band)).fill(
    LD_NOT_COMPUTED,
  )

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

  return {
    snps,
    ldValues,
    metric,
    hasR2,
    hasDprime,
    band,
  }
}
