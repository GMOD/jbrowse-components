import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LD_NOT_COMPUTED, isLDRecordSource } from '@jbrowse/ld-core'

import { bpInRegion } from '../PlinkLDAdapter/bpInRegion.ts'
import { bandCellCount, bandPairIndex } from './ldBand.ts'

import type { LDMatrixResult, LDMetric, LDSnp } from './ldTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

/**
 * Cells past which a fetch refuses rather than allocates: 40 MB of `ldValues`,
 * and up to 200 MB of GPU instances at genomic positions. The tutorials' full
 * triangle of 1,258 variants is 790k cells.
 */
export const MAX_LD_CELLS = 10_000_000

// The id is part of the key because two variants can share a position: a site
// split into one record per allele, or a SNP beside an indel.
function snpKey(refName: string, bp: number, id = '') {
  return `${refName}:${bp}:${id}`
}

function metricValue(record: PlinkLDRecord, ldMetric: LDMetric) {
  const v = ldMetric === 'dprime' ? record.dprime : record.r2
  return v !== undefined && Number.isFinite(v) ? v : LD_NOT_COMPUTED
}

/**
 * The metric the file can serve. A `--r2 dprime` emit carries DP and no R2, so
 * an r² request against it would otherwise read every pair as missing.
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

function regionIndexOf(refName: string, bp: number, regions: Region[]) {
  return regions.findIndex(r => r.refName === refName && bpInRegion(bp, r))
}

/**
 * Every SNP either side of a record names, in the order the view draws them:
 * regions as `regions` lists them, and bp descending inside a reversed one.
 * The matrix's row and column index is this order, so each renderer reads
 * columns left to right.
 */
function collectScreenOrderedSnps(records: PlinkLDRecord[], regions: Region[]) {
  const byKey = new Map<string, { snp: LDSnp; rank: number; pos: number }>()
  const add = (refName: string, bp: number, id: string, maf?: number) => {
    const key = snpKey(refName, bp, id)
    if (!byKey.has(key)) {
      const rank = regionIndexOf(refName, bp, regions)
      byKey.set(key, {
        snp: {
          id,
          refName,
          start: bp - 1,
          end: bp,
          maf: maf !== undefined && Number.isFinite(maf) ? maf : undefined,
        },
        rank,
        pos: regions[rank]!.reversed ? -bp : bp,
      })
    }
  }
  for (const r of records) {
    add(r.chrA, r.bpA, r.snpA, r.mafA)
    add(r.chrB, r.bpB, r.snpB, r.mafB)
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.pos - b.pos ||
        (a.snp.id ?? '').localeCompare(b.snp.id ?? ''),
    )
    .map(k => k.snp)
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
    field?: LDMetric
  }
}): Promise<LDMatrixResult> {
  const { regions, adapterConfig, sessionId, field = 'r2' } = args

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

  const header = await dataAdapter.getHeader(args)
  const hasR2 = header.r2Idx >= 0
  const hasDprime = header.dprimeIdx >= 0
  const appliedField = resolveMetric(field, { hasR2, hasDprime })

  // A pair is fetched by the region its A side is in and kept where its B side
  // is in any displayed region, so a pair spanning two blocks loads. A tabix
  // index built on other columns returns pairs whose A is outside the query.
  const perRegion = await Promise.all(
    regions.map(async region =>
      (
        await dataAdapter.getLDRecords(
          { refName: region.refName, start: region.start, end: region.end },
          args,
        )
      ).filter(
        r =>
          bpInRegion(r.bpA, region) &&
          regionIndexOf(r.chrB, r.bpB, regions) !== -1,
      ),
    ),
  )
  const records = perRegion.flat()

  const snps = collectScreenOrderedSnps(records, regions)
  const indexByKey = new Map<string, number>()
  for (const [idx, snp] of snps.entries()) {
    indexByKey.set(snpKey(snp.refName, snp.end, snp.id), idx)
  }

  // The band is the widest pair the file lists, so it hides nothing: plink's
  // `--ld-window` already bounded the pairs when it wrote the file.
  const pairs: { slotI: number; slotJ: number; value: number }[] = []
  let band = 0
  for (const record of records) {
    const i = indexByKey.get(snpKey(record.chrA, record.bpA, record.snpA))!
    const j = indexByKey.get(snpKey(record.chrB, record.bpB, record.snpB))!
    const value = metricValue(record, appliedField)
    if (i !== j && value !== LD_NOT_COMPUTED) {
      pairs.push({ slotI: i, slotJ: j, value })
      band = Math.max(band, Math.abs(i - j))
    }
  }

  const numCells = bandCellCount(snps.length, band)
  if (numCells > MAX_LD_CELLS) {
    throw new Error(
      `${snps.length.toLocaleString()} variants in view would need ${numCells.toLocaleString()} LD cells; zoom in`,
    )
  }
  // A pair the file does not list was never measured: plink's default
  // `--ld-window-r2 0.2` leaves most pairs out, and a D' for one of them is no
  // more 0 than it is 1.
  const ldValues = new Float32Array(numCells).fill(LD_NOT_COMPUTED)
  for (const { slotI, slotJ, value } of pairs) {
    ldValues[bandPairIndex(slotI, slotJ, band)] = value
  }

  return {
    snps,
    ldValues,
    appliedField,
    hasR2,
    hasDprime,
    band,
  }
}
