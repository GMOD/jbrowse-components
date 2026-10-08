import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { LDRecordSource } from '@jbrowse/ld-core'

/**
 * The LD join a fetch asks `GWASAdapter` for. The caller resolves both members
 * against the queried contig, since the `ldAdapter`'s file may spell it
 * otherwise than the GWAS file.
 */
export interface LdJoin {
  /** The index SNP's 0-based start on the queried contig. */
  start: number
  /** The queried contig as the `ldAdapter`'s file names it. */
  refName: string
}

export interface GWASFetchOptions extends BaseOptions {
  ld?: LdJoin
}

/**
 * How far either side of a placed index to read, PLINK's `--ld-window-kb`
 * default. The file was written at some window already, so reading wider only
 * reads empty space.
 */
export const LD_WINDOW_BP = 1_000_000

/** The notice a region holding the index SNP carries when no point joined to it. */
export const INDEX_SNP_MISSING =
  'No point has LD data to the index SNP, so every other point is grey: check that the LD file covers the index SNP and that the assembly’s aliases cover its reference names (e.g. “chr2” vs “2”)'

/** PLINK writes `.` for a variant with no id, which names nothing. */
function isNamedSnp(name: unknown): name is string {
  return typeof name === 'string' && name !== '' && name !== '.'
}

/** Partner r² by SNP id and by 0-based start on the queried contig. */
export interface LdToIndex {
  byName: Map<string, number>
  byStart: Map<number, number>
}

/**
 * Where to read the `.ld` file: around the index, not the fetched region,
 * because an index over the file finds a row by its A side, so a window
 * without the index returns no row naming it. On `test_data/gwas/SLE.ld` a
 * 200 kb pan off the index took 1212 partners to 0.
 */
function ldWindow({ start, refName }: LdJoin) {
  return {
    refName,
    start: Math.max(0, start - LD_WINDOW_BP),
    end: start + 1 + LD_WINDOW_BP,
  }
}

/**
 * Every pair in the window with the index on exactly one side, keyed by the
 * other side. PLINK emits a pair once, so the index may be either side. A pair
 * with no r², from a `--r2 dprime` file without the column, joins nothing.
 */
export async function ldToIndex(
  source: Pick<LDRecordSource, 'getLDRecords'>,
  join: LdJoin,
  opts?: BaseOptions,
): Promise<LdToIndex> {
  const { start, refName } = join
  const isIndex = (chr: string, bp: number) =>
    chr === refName && bp - 1 === start
  const query = ldWindow(join)
  const records = await source.getLDRecords(query, opts)
  const byName = new Map<string, number>()
  const byStart = new Map<number, number>()
  let found = false
  for (const { r2, snpA, chrA, bpA, snpB, chrB, bpB } of records) {
    if (r2 === undefined) {
      continue
    }
    const aIsIndex = isIndex(chrA, bpA)
    if (aIsIndex !== isIndex(chrB, bpB)) {
      found = true
      const snp = aIsIndex ? snpB : snpA
      if (isNamedSnp(snp)) {
        byName.set(snp, r2)
      }
      if ((aIsIndex ? chrB : chrA) === refName) {
        byStart.set((aIsIndex ? bpB : bpA) - 1, r2)
      }
    }
  }
  if (!found && records.length > 0) {
    const r = records[0]!
    console.warn(
      `LD coloring: the index SNP matched none of ${records.length} LD records in ${query.refName}:${query.start}-${query.end} (e.g. SNP_A "${r.snpA}" at ${r.chrA}:${r.bpA}), so no point has an r² to it. The index is probably absent from the LD file, or named differently there than in the GWAS file.`,
    )
  }
  return { byName, byStart }
}

/**
 * A feature's r² to the index and its part in the join, or undefined where it
 * has neither. The index SNP joins whether or not the LD file names it.
 */
export function ldOf(
  feature: Feature,
  ld: LdToIndex,
  join: LdJoin,
): { r2: number; role: 'index' | 'partner' } | undefined {
  const name: unknown = feature.get('name')
  const start = feature.get('start')
  if (start === join.start) {
    return { r2: 1, role: 'index' }
  }
  const r2 =
    (isNamedSnp(name) ? ld.byName.get(name) : undefined) ??
    ld.byStart.get(start)
  return r2 === undefined ? undefined : { r2, role: 'partner' }
}
