import { SimpleFeature } from '@jbrowse/core/util'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { LDRecordSource } from '@jbrowse/ld-core'

/** The field the join writes: a SNP's r² to the index, 1 on the index. */
export const LD_FIELD = 'ld'

/** The field naming a joined SNP's part: `index`, or `partner` of it. */
export const LD_ROLE_FIELD = 'ld_role'

/**
 * The LD join a fetch asks `GWASAdapter` for. The caller resolves both names:
 * the index SNP against the view's contig, and `refName` against the
 * `ldAdapter`'s file, which may spell the contig otherwise than the GWAS file.
 */
export interface LdJoin {
  /** The index SNP: its id, or its 0-based start on the queried contig. */
  index: { name: string } | { start: number }
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

/** PLINK writes `.` for a variant with no id, which names nothing. */
export function isNamedSnp(name: unknown): name is string {
  return typeof name === 'string' && name !== '' && name !== '.'
}

/** Partner r² by SNP id and by 0-based start on the queried contig. */
export interface LdToIndex {
  byName: Map<string, number>
  byStart: Map<number, number>
}

/**
 * Where to read the `.ld` file. A placed index anchors the window, because an
 * index over the file finds a row by its A side, so a window without the index
 * returns no row naming it: on `test_data/gwas/SLE.ld` a 200 kb pan off the
 * index took 1212 partners to 0. A bare id has no position until a record
 * names it, so the region is the only window there is.
 */
function ldWindow(region: Region, { index, refName }: LdJoin) {
  return 'start' in index
    ? {
        refName,
        start: Math.max(0, index.start - LD_WINDOW_BP),
        end: index.start + 1 + LD_WINDOW_BP,
      }
    : { refName, start: region.start, end: region.end }
}

/**
 * Every pair in the window with the index on exactly one side, keyed by the
 * other side. PLINK emits a pair once, so the index may be either side. A pair
 * with no r², from a `--r2 dprime` file without the column, joins nothing.
 */
export async function ldToIndex(
  source: Pick<LDRecordSource, 'getLDRecords'>,
  region: Region,
  join: LdJoin,
): Promise<LdToIndex> {
  const { index, refName } = join
  const isIndex = (snp: string, chr: string, bp: number) =>
    'start' in index
      ? chr === refName && bp - 1 === index.start
      : isNamedSnp(snp) && snp === index.name
  const query = ldWindow(region, join)
  const records = await source.getLDRecords(query)
  const byName = new Map<string, number>()
  const byStart = new Map<number, number>()
  let found = false
  for (const { r2, snpA, chrA, bpA, snpB, chrB, bpB } of records) {
    if (r2 === undefined) {
      continue
    }
    const aIsIndex = isIndex(snpA, chrA, bpA)
    if (aIsIndex !== isIndex(snpB, chrB, bpB)) {
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
 * The feature with its r² to the index and its part in the join, or the
 * feature itself where it has neither. The index SNP joins whether or not the
 * LD file names it.
 */
export function joinLd(feature: Feature, ld: LdToIndex, { index }: LdJoin) {
  const name: unknown = feature.get('name')
  const start = feature.get('start')
  const named = isNamedSnp(name)
  const isIndex =
    'start' in index ? start === index.start : named && name === index.name
  const r2 = isIndex
    ? 1
    : ((named ? ld.byName.get(name) : undefined) ?? ld.byStart.get(start))
  return r2 === undefined
    ? feature
    : new SimpleFeature({
        ...feature.toJSON(),
        [LD_FIELD]: r2,
        [LD_ROLE_FIELD]: isIndex ? 'index' : 'partner',
      })
}
