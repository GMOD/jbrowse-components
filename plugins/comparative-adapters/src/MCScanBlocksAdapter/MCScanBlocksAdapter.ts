import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { ComparativeAdapterBase } from '../ComparativeAdapterBase.ts'
import {
  indexBlockRows,
  joinBedPair,
  makeBlockFeatures,
} from '../mcscanUtil.ts'
import { parseBed, readFiles } from '../util.ts'

import type { BareFeature, BlockRow, BlockRowIndex } from '../mcscanUtil.ts'
import type { MCScanBlocksAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

// Per column: how many cells name a gene, and how many of those its BED places.
// Both come out of one pass, and the two numbers are what tells apart the two
// ways this config goes wrong. Neither one draws anything, and neither one used
// to say so.
//
// EVERY column dead is overwhelmingly one mistake: blockAssemblies and
// bedLocations are positional against the FILE's column order, so a config
// listing them in the order the genomes are displayed in, or the order they were
// passed to whatever wrote the table, looks every gene up in another genome's
// BED.
//
// ONE column dead is the other, and it is the quieter of the two: that genome's
// ids were written by a different tool than its BED (an isoform suffix, an
// Ensembl `gene:` namespace, a FASTA header truncated at the first space). The
// remaining columns still resolve, so the track loads and most bands draw, and
// only the ones touching that genome are empty — which reads exactly like a
// genome with no orthologs in view. Nothing downstream can distinguish those,
// because by then the column is gone; here both numbers are still in hand.
//
// Rows sampled when working out which BED each column's genes actually live in.
// That search is n^2 in the column count, and a permutation shows itself in the
// first handful of rows, so there is nothing to buy by reading a whole table.
const PERMUTATION_SAMPLE_ROWS = 2000

// Which bedLocations entry each column's genes are actually in, when that is a
// permutation of the columns and every column has one. Runs only on the failure
// path, and turns "nothing resolves" into the reordering that fixes it —
// otherwise a puzzle the reader has to solve against a file's column order they
// may never have looked at. Anything that is not a clean permutation returns
// nothing rather than a guess, since a wrong suggestion is worse than none.
function findColumnBedPermutation(
  blockLines: string[][],
  bedMaps: Map<string, BareFeature>[],
) {
  const n = bedMaps.length
  const sample = blockLines.slice(0, PERMUTATION_SAMPLE_ROWS)
  const best: number[] = []
  for (let i = 0; i < n; i++) {
    const hits = new Array<number>(n).fill(0)
    for (const cols of sample) {
      const name = cols[i]
      if (name && name !== '.') {
        for (let j = 0; j < n; j++) {
          if (bedMaps[j]!.has(name)) {
            hits[j]!++
          }
        }
      }
    }
    const top = hits.indexOf(Math.max(...hits))
    if (hits[top] === 0) {
      return undefined
    }
    best.push(top)
  }
  return new Set(best).size === n ? best : undefined
}

// A file where every column resolves stops as soon as each has placed one gene,
// so the healthy path still costs a handful of rows. Only a file with something
// to report reads to the end, which is where the exact per-column counts the
// message needs come from.
function checkColumnsResolve(
  blockLines: string[][],
  bedMaps: Map<string, BareFeature>[],
  blockAssemblies: string[],
) {
  const named = new Array<number>(bedMaps.length).fill(0)
  const placed = new Array<number>(bedMaps.length).fill(0)
  let resolving = 0
  for (const cols of blockLines) {
    for (let i = 0; i < bedMaps.length; i++) {
      const name = cols[i]
      // `.` is the file's own "no ortholog here", not an unresolvable id
      if (name && name !== '.') {
        named[i]!++
        if (bedMaps[i]!.has(name)) {
          resolving += placed[i] === 0 ? 1 : 0
          placed[i]!++
        }
      }
    }
    if (resolving === bedMaps.length) {
      return
    }
  }
  // a column of nothing but `.` is a legitimate column with no claim to check
  const filled = bedMaps.map((_, i) => i).filter(i => named[i]! > 0)
  const dead = filled.filter(i => placed[i] === 0)
  if (!dead.length) {
    return
  }
  if (dead.length === filled.length) {
    const permutation = findColumnBedPermutation(blockLines, bedMaps)
    const fix = permutation
      ? ` Each column's genes are in another column's BED (${permutation.map((j, i) => `column ${i} in bedLocations[${j}]`).join(', ')}), so putting bedLocations in the file's column order fixes it.`
      : ''
    throw new Error(
      `none of the ${blockLines.length} rows in this .blocks file name genes present in its BED files; blockAssemblies ${JSON.stringify(blockAssemblies)} and bedLocations have to be in the file's own column order, which is not necessarily the order assemblyNames lists.${fix}`,
    )
  }
  const which = dead
    .map(i => `${blockAssemblies[i]} (column ${i}, ${named[i]} gene ids)`)
    .join(', ')
  throw new Error(
    `this .blocks file's ${which} names no gene present in that column's bedLocations entry, while its other columns resolve — so that BED is keyed on different ids, not on a genome without orthologs here. A gene is matched against BED column 4 byte for byte, and the usual culprits are an isoform suffix, an Ensembl \`gene:\` prefix on one side only, or a FASTA header truncated at the first space.`,
  )
}

// The numeric columns a row carries past its gene columns, named by
// `attributeColumns` in order. A `.blocks` table is gene ids and nothing else,
// so a measurement that came with the orthology — Ensembl Compara's per-pair
// identity, dN, dS and gene-order-conservation score — has nowhere to go
// otherwise, and every one of them is discarded at the point the table is
// written.
//
// Anything that is not a number is a missing value, not a zero. Compara writes
// `NULL` for a dN it could not estimate, and a zero there is a dN/dS of zero,
// which reads as total purifying selection rather than as no answer. Undefined
// where a row carries none, so the common table allocates nothing per row.
function parseRowAttrs(
  cols: string[],
  firstColumn: number,
  attributeColumns: string[],
) {
  let attrs: Record<string, number> | undefined
  for (let i = 0; i < attributeColumns.length; i++) {
    const raw = cols[firstColumn + i]?.trim()
    if (raw && raw !== '.' && raw !== 'NA' && raw !== 'NULL') {
      const value = Number(raw)
      if (Number.isFinite(value)) {
        attrs ??= {}
        attrs[attributeColumns[i]!] = value
      }
    }
  }
  return attrs
}

// EVERY column a genome occupies, which is not always one. `jcvi mcscan` writes
// a column per chain of synteny blocks rather than per genome, so at `--iter=2`
// a grape gene syntenic to two peach regions has a peach id in each of two
// columns, and taking only the first drew half the links with nothing saying so.
// The same shape is a self-comparison — wheat's homoeologs against each other,
// or an MCScanX whole-genome-duplication run — where one assembly holds both
// columns and the mate is its LATER appearance rather than the query's own.
// `mcscanUtil.facingSides` anticipates the self case for the anchors adapters;
// the copy columns are blocks-only, since an `.anchors` file has no columns to
// put them in.
function columnsFor(blockAssemblies: string[], assembly: string) {
  const out: number[] = []
  for (let i = 0; i < blockAssemblies.length; i++) {
    if (blockAssemblies[i] === assembly) {
      out.push(i)
    }
  }
  return out
}

// The (query column, mate column) joins a pair draws, one per copy column on
// either side. A self-comparison takes each unordered pair once: both ends of
// its join are in the same genome and `makeBlockFeatures` already emits every
// row from both sides, so (1,0) as well as (0,1) would draw each link twice.
function columnPairs(
  blockAssemblies: string[],
  queryAssembly: string,
  mateAssembly: string,
) {
  const self = queryAssembly === mateAssembly
  const out: [number, number][] = []
  for (const a of columnsFor(blockAssemblies, queryAssembly)) {
    for (const b of columnsFor(blockAssemblies, mateAssembly)) {
      if (a !== b && !(self && a > b)) {
        out.push([a, b])
      }
    }
  }
  return out
}

// A .blocks file has one column per genome (column 0 is the reference). Because
// it describes N genomes at once, one track can back every band of a multi-way
// view: parse all columns + BEDs once, then resolve which pair to draw per query
// from the queried assembly and the band's target assembly. A given band draws
// the pair (query assembly, target assembly); a query with no target — a plain
// LGVSyntenyDisplay, or the region launch asking what a locus aligns to — draws
// every pair the track declares, which for a legacy 2-entry assemblyNames config
// is the same single mate it always was.
export default class MCScanBlocksAdapter extends ComparativeAdapterBase<MCScanBlocksAdapterConfig> {
  setup = cachedSetup({ setup: (opts: BaseOptions) => this.setupPre(opts) })

  async setupPre(opts: BaseOptions) {
    const blockAssemblies = this.getConf('blockAssemblies')
    const bedLocations = this.getConf('bedLocations') as FileLocation[]
    // one BED per column, all present: caught here so a misconfigured track
    // fails with the offending column rather than an opaque openLocation error
    // deep in the download
    if (bedLocations.length !== blockAssemblies.length) {
      throw new Error(
        `MCScanBlocksAdapter: blockAssemblies lists ${blockAssemblies.length} columns but bedLocations has ${bedLocations.length}; supply exactly one BED per column`,
      )
    }
    const missing = blockAssemblies.filter((_, i) => !bedLocations[i])
    if (missing.length) {
      throw new Error(
        `MCScanBlocksAdapter: missing BED file for column(s) ${missing.join(', ')}; each genome column needs its BED`,
      )
    }
    const pm = this.pluginManager
    const [blockstext, ...bedtexts] = await readFiles(
      [
        openLocation(this.getConf('mcscanBlocksLocation'), pm),
        ...bedLocations.map(b => openLocation(b, pm)),
      ],
      opts,
    )
    const bedMaps = bedtexts.map(t => parseBed(t))
    const blockLines = blockstext!
      .split(/\n|\r\n|\r/)
      .filter(f => !!f)
      .map(l => l.split('\t'))
    checkColumnsResolve(blockLines, bedMaps, blockAssemblies)
    // The joined rows per ordered column pair, filled on first use. A band
    // fetches one region at a time and a stacked view has one band per adjacent
    // pair, so without this a six-genome whole-genome view re-joined the whole
    // table once per chromosome per band — the same Map lookups and the same
    // row objects, thrown away and rebuilt on every pan. The pairs are bounded
    // by the column count, and each holds what the file already holds.
    const pairRows = new Map<string, BlockRowIndex>()
    // parsed once per row rather than once per row per pair: the columns sit
    // past every gene column, so they say the same thing whichever pair is drawn
    const attributeColumns = this.getConf('attributeColumns')
    const rowAttrs = attributeColumns.length
      ? blockLines.map(cols =>
          parseRowAttrs(cols, blockAssemblies.length, attributeColumns),
        )
      : undefined
    return { blockAssemblies, bedMaps, blockLines, rowAttrs, pairRows }
  }

  // The two columns of a pair joined into gene-link rows (both sides present),
  // built once per ordered pair and held on the shared setup. The join depends
  // on nothing but the file, so it is the same answer for every region and every
  // band that asks for that pair.
  //
  // One gene pair draws once however many rows name it: a repeat is the same two
  // genes at the same coordinates, and alpha is per link, so it darkens the band
  // rather than adding to it. Both ordinary table shapes produce repeats and
  // neither can avoid it at the writer, so the first row wins.
  private pairRows(
    colA: number,
    colB: number,
    {
      bedMaps,
      blockLines,
      rowAttrs,
      pairRows,
    }: Awaited<ReturnType<typeof this.setupPre>>,
  ) {
    const key = `${colA}-${colB}`
    let rows = pairRows.get(key)
    if (!rows) {
      const seen = new Set<string>()
      const joined = blockLines
        .map((cols, rowNum): BlockRow | undefined => {
          const pair = joinBedPair(
            bedMaps[colA]!,
            bedMaps[colB]!,
            cols[colA],
            cols[colB],
          )
          if (pair === undefined) {
            return undefined
          }
          const link = `${cols[colA]}\t${cols[colB]}`
          if (seen.has(link)) {
            return undefined
          }
          seen.add(link)
          return {
            ...pair,
            rowNum,
            strand: pair.a.strand * pair.b.strand,
            attrs: rowAttrs?.[rowNum],
          }
        })
        .filter(f => f !== undefined)
      rows = indexBlockRows(joined)
      pairRows.set(key, rows)
    }
    return rows
  }

  // The columns a query draws against: the single band target when a view
  // passes one, otherwise every other assembly the track declares.
  //
  // "No target" means "what aligns here at all", which is the answer the
  // all-vs-all adapters already give and what an LGVSyntenyDisplay and the
  // region-launch mate discovery ask for. Collapsing it to one arbitrary column
  // left a three-genome table drawing only its first pair in both places, with
  // no sign that the rest of the table existed. A track pinned to a pair (two
  // entries in assemblyNames, the legacy shape) is unaffected — that list is
  // what bounds this.
  private mateAssemblies(queryAssembly: string, targetAssemblyName?: string) {
    if (targetAssemblyName !== undefined) {
      return [targetAssemblyName]
    }
    const names = this.getConf('assemblyNames')
    // deduped, because a genome in several columns is free to be listed once per
    // column here too, and each name is drawn against all of its columns already
    const others = [...new Set(names.filter(n => n !== queryAssembly))]
    // A self-comparison names one assembly twice, so "every other assembly" is
    // empty and the track would answer nothing at all. Its mate is itself.
    return others.length ? others : names.slice(0, 1)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { assemblyName, targetAssemblyName } = opts
    // An assembly in none of the file's columns has the same answer whatever
    // the rows say, and the columns are config. Answered before the setup
    // rather than after, which was downloading and parsing the blocks table and
    // every BED to return [].
    if (assemblyName === undefined) {
      return []
    }
    const blockAssemblies = this.getConf('blockAssemblies')
    const qcols = columnsFor(blockAssemblies, assemblyName)
    if (!qcols.length) {
      return []
    }
    const setup = await this.setup(opts)
    const { bedMaps, blockLines } = setup
    const set = new Set<string>()
    // when a target is given, scope to that pair (rows where both are present),
    // which is nothing when the target is in no column; otherwise (e.g. the
    // assembly-swap check) report across all pairs
    if (targetAssemblyName !== undefined) {
      for (const [qcol, mcol] of columnPairs(
        blockAssemblies,
        assemblyName,
        targetAssemblyName,
      )) {
        for (const { a } of this.pairRows(qcol, mcol, setup).rows) {
          set.add(a.refName)
        }
      }
    } else {
      for (const col of qcols) {
        for (const cols of blockLines) {
          const name = cols[col]
          const r = name ? bedMaps[col]!.get(name) : undefined
          if (r) {
            set.add(r.refName)
          }
        }
      }
    }
    return [...set]
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const setup = await this.setup(opts)
      const { blockAssemblies } = setup
      const queryAssembly = region.assemblyName
      const mateAssemblies = this.mateAssemblies(
        queryAssembly,
        opts.targetAssemblyName,
      )
      if (
        !columnsFor(blockAssemblies, queryAssembly).length ||
        !mateAssemblies.length
      ) {
        throw new Error(
          `blockAssemblies ${JSON.stringify(blockAssemblies)} must contain ${queryAssembly}, and assemblyNames must name another assembly to draw it against`,
        )
      }
      for (const mateAssembly of mateAssemblies) {
        const pairs = columnPairs(blockAssemblies, queryAssembly, mateAssembly)
        if (!pairs.length) {
          throw new Error(
            `blockAssemblies ${JSON.stringify(blockAssemblies)} must contain both ${queryAssembly} and ${mateAssembly}, with matching bedLocations`,
          )
        }
        for (const [qcol, mcol] of pairs) {
          const rows = this.pairRows(qcol, mcol, setup)
          // the columns key the ids apart, so the same source row joined to two
          // different genomes — or to two copy columns of one genome — stays two
          // features
          for (const feat of makeBlockFeatures(
            [queryAssembly, mateAssembly],
            rows,
            region,
            `${qcol}-${mcol}-`,
          )) {
            observer.next(feat)
          }
        }
      }
      observer.complete()
    })
  }
}
