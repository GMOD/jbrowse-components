import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LD_NOT_COMPUTED, isLDRecordSource } from '@jbrowse/ld-core'

import { bpInRegion } from '../PlinkLDAdapter/bpInRegion.ts'
import { bandCellCount, bandPairIndex } from './ldBand.ts'
import { regionIndexOf } from './ldLayout.ts'

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

/**
 * A memory cap, not a budget: force load does not lift it, so it travels as the
 * thrown refusal (an error bar with no Retry) rather than as a `regionTooLarge`
 * result, whose banner offers Force load.
 */
class LDCellCapError extends Error {
  override name = 'LDCellCapError'
  regionTooLarge = true
}

/**
 * Each SNP's column, by refName, then bp, then id: the id is part of the key
 * because two variants can share a position, a site split into one record per
 * allele, or a SNP beside an indel. Nested maps rather than one string key, so
 * a pair costs lookups and no string building.
 */
type SnpColumns = Map<string, Map<number, Map<string, number>>>

function idsAt(columns: SnpColumns, refName: string, bp: number) {
  let byBp = columns.get(refName)
  if (!byBp) {
    byBp = new Map()
    columns.set(refName, byBp)
  }
  let ids = byBp.get(bp)
  if (!ids) {
    ids = new Map()
    byBp.set(bp, ids)
  }
  return ids
}

function columnOf(
  columns: SnpColumns,
  refName: string,
  bp: number,
  id: string,
) {
  return columns.get(refName)!.get(bp)!.get(id)!
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

/**
 * Every SNP either side of a record names, in the order the view draws them:
 * regions as `regions` lists them, and bp descending inside a reversed one.
 * The matrix's row and column index is this order, so each renderer reads
 * columns left to right.
 */
function collectScreenOrderedSnps(records: PlinkLDRecord[], regions: Region[]) {
  const columns: SnpColumns = new Map()
  const found: { snp: LDSnp; rank: number; pos: number }[] = []
  const add = (refName: string, bp: number, id: string, maf?: number) => {
    const ids = idsAt(columns, refName, bp)
    if (!ids.has(id)) {
      ids.set(id, -1)
      const rank = regionIndexOf(refName, bp, regions)
      found.push({
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
  const snps = found
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.pos - b.pos ||
        (a.snp.id ?? '').localeCompare(b.snp.id ?? ''),
    )
    .map(k => k.snp)
  for (const [column, { refName, end, id = '' }] of snps.entries()) {
    idsAt(columns, refName, end).set(id, column)
  }
  return { snps, columns }
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
          r.chrA === region.refName &&
          bpInRegion(r.bpA, region) &&
          regionIndexOf(r.chrB, r.bpB, regions) !== -1,
      ),
    ),
  )
  const records = perRegion.flat()

  const { snps, columns } = collectScreenOrderedSnps(records, regions)

  // The band is the widest pair the file lists, so it hides nothing: plink's
  // `--ld-window` already bounded the pairs when it wrote the file.
  const rows = new Int32Array(records.length)
  const cols = new Int32Array(records.length)
  let band = 0
  for (const [k, r] of records.entries()) {
    const i = columnOf(columns, r.chrA, r.bpA, r.snpA)
    const j = columnOf(columns, r.chrB, r.bpB, r.snpB)
    rows[k] = i
    cols[k] = j
    if (i !== j && metricValue(r, appliedField) !== LD_NOT_COMPUTED) {
      band = Math.max(band, Math.abs(i - j))
    }
  }

  const numCells = bandCellCount(snps.length, band)
  if (numCells > MAX_LD_CELLS) {
    throw new LDCellCapError(
      `${snps.length.toLocaleString()} variants in view would need ${numCells.toLocaleString()} LD cells; zoom in`,
    )
  }
  // A pair the file does not list was never measured: plink's default
  // `--ld-window-r2 0.2` leaves most pairs out, and a D' for one of them is no
  // more 0 than it is 1.
  const ldValues = new Float32Array(numCells).fill(LD_NOT_COMPUTED)
  for (const [k, r] of records.entries()) {
    const i = rows[k]!
    const j = cols[k]!
    const value = metricValue(r, appliedField)
    if (i !== j && value !== LD_NOT_COMPUTED) {
      ldValues[bandPairIndex(i, j, band)] = value
    }
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
