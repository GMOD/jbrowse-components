import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { doesIntersect2, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { PairwiseAdapterBase } from '../PairwiseAdapterBase.ts'
import SyntenyFeature from '../SyntenyFeature/index.ts'
import { collectLines, indexRecordsByName } from '../util.ts'

import type { BlastTabularAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// Blast output column names/descriptions taken from
// https://www.ncbi.nlm.nih.gov/books/NBK279684/#_appendices_Options_for_the_commandline_a_
interface BlastColumns {
  /** Query Seq-id */
  qseqid?: string
  /** Query GI */
  qgi?: string
  /** Query accesion */
  qacc?: string
  /** Subject Seq-id */
  sseqid?: string
  /** All subject Seq-id(s), separated by a ';' */
  sallseqid?: string
  /** Subject GI */
  sgi?: string
  /** All subject GIs */
  sallgi?: string
  /** Subject accession */
  sacc?: string
  /** All subject accessions */
  sallacc?: string
  /** Start of alignment in query */
  qstart?: number
  /** End of alignment in query */
  qend?: number
  /** Start of alignment in subject */
  sstart?: number
  /** End of alignment in subject */
  send?: number
  /** Aligned part of query sequence */
  qseq?: string
  /** Aligned part of subject sequence */
  sseq?: string
  /** Expect value */
  evalue?: string
  /** Bit score */
  bitscore?: string
  /** Raw score */
  score?: string
  /** Alignment length */
  length?: string
  /** Percentage of identical matches */
  pident?: string
  /** Number of identical matches */
  nident?: string
  /** Number of mismatches */
  mismatch?: string
  /** Number of positive-scoring matches */
  positive?: string
  /** Number of gap openings */
  gapopen?: string
  /** Total number of gap */
  gaps?: string
  /** Percentage of positive-scoring matches */
  ppos?: string
  /** Query and subject frames separated by a '/' */
  frames?: string
  /** Query frame */
  qframe?: string
  /** Subject frame */
  sframe?: string
  /** Blast traceback operations (BTOP) */
  btop?: string
  /** Unique Subject Taxonomy ID(s), separated by a ';'(in numerical order) */
  staxids?: string
  /** Unique Subject Scientific Name(s), separated by a ';' */
  sscinames?: string
  /** Unique Subject Common Name(s), separated by a ';' */
  scomnames?: string
  /**
   * Unique Subject Blast Name(s), separated by a ';' (in alphabetical order)
   */
  sblastnames?: string
  /**
   * Unique Subject Super Kingdom(s), separated by a ';' (in alphabetical order)
   */
  sskingdoms?: string
  /** Subject Title */
  stitle?: string
  /** All Subject Title(s), separated by a '<>' */
  salltitles?: string
  /** Subject Strand */
  sstrand?: string
  /** Query Coverage Per Subject (for all HSPs) */
  qcovs?: string
  /** Query Coverage Per HSP */
  qcovhsp?: string
  /**
   * A measure of Query Coverage that counts a position in a subject sequence
   * for this measure only once. The second time the position is aligned to the
   * query is not counted towards this measure.
   */
  qcovus?: string
}

// Blast output column names/descriptions taken from
// https://www.ncbi.nlm.nih.gov/books/NBK279684/#_appendices_Options_for_the_commandline_a_
interface BlastRecord extends BlastColumns {
  /** Query Seq-id */
  qseqid: string
  /** Subject Seq-id */
  sseqid: string
  /** Start of alignment in query */
  qstart: number
  /** End of alignment in query */
  qend: number
  /** Start of alignment in subject */
  sstart: number
  /** End of alignment in subject */
  send: number
}

const REQUIRED_COLUMNS = [
  'qseqid',
  'sseqid',
  'qstart',
  'qend',
  'sstart',
  'send',
] as const

function createBlastLineParser(columns: string) {
  const columnNames = columns.trim().split(' ') as (keyof BlastRecord)[]
  const requiredIndices = {} as Record<
    (typeof REQUIRED_COLUMNS)[number],
    number
  >
  for (const col of REQUIRED_COLUMNS) {
    const idx = columnNames.indexOf(col)
    if (idx === -1) {
      throw new Error(`Missing required column "${col}"`)
    }
    requiredIndices[col] = idx
  }
  const {
    qseqid: qseqidIndex,
    sseqid: sseqidIndex,
    qstart: qstartIndex,
    qend: qendIndex,
    sstart: sstartIndex,
    send: sendIndex,
  } = requiredIndices
  // BlastColumns fields are all string except qstart/qend/sstart/send (number);
  // those are all in REQUIRED_COLUMNS and filtered out below, so remaining
  // entries are safely writable as strings.
  type StringColumn = Exclude<
    keyof BlastColumns,
    'qstart' | 'qend' | 'sstart' | 'send'
  >
  const extraColumns = new Map<StringColumn, number>(
    columnNames
      .map((c, idx) => [c, idx] as const)
      .filter(
        (f): f is [StringColumn, number] =>
          !(REQUIRED_COLUMNS as readonly string[]).includes(f[0]),
      ),
  )
  return (line: string): BlastRecord | undefined => {
    if (line.startsWith('#')) {
      return
    }
    const row = line.split('\t')
    const qseqid = row[qseqidIndex]
    const sseqid = row[sseqidIndex]
    const qstart = row[qstartIndex]
    const qend = row[qendIndex]
    const sstart = row[sstartIndex]
    const send = row[sendIndex]
    if (!(qseqid && sseqid && qstart && qend && sstart && send)) {
      console.warn('Invalid BLAST line')
      console.warn(line)
      return
    }
    const record: BlastRecord = {
      qseqid,
      sseqid,
      qstart: Number.parseInt(qstart),
      qend: Number.parseInt(qend),
      sstart: Number.parseInt(sstart),
      send: Number.parseInt(send),
    }
    for (const [columnName, idx] of extraColumns.entries()) {
      const value = row[idx]
      if (value) {
        record[columnName] = value
      }
    }
    return record
  }
}

// One side of a BLAST hit resolved to the perspective the view is anchored on,
// in JBrowse coordinates: BLAST writes 1-based inclusive coordinates and encodes
// orientation by writing start > end, so each side is normalized to a forward
// half-open interval carrying its own strand. The feature's strand is the
// product, i.e. -1 when the two sides disagree.
function orientBlastSide(startCol: number, endCol: number) {
  const flipped = startCol > endCol
  const start = flipped ? endCol : startCol
  const end = flipped ? startCol : endCol
  return { start: start - 1, end, strand: flipped ? -1 : 1 }
}

// BLAST states percent identity per hit; without it a synteny track colored by
// identity has nothing to read (`pident` rides along as a string tag, which the
// identity ramp does not look at).
function blastIdentity(pident: string | undefined) {
  const v = Number(pident)
  return Number.isFinite(v) ? v / 100 : undefined
}

export default class BlastTabularAdapter extends PairwiseAdapterBase<BlastTabularAdapterConfig> {
  // Download+parse plus the per-refName index every query walks, for the reason
  // indexRecordsByName documents: a region query used to test every hit in the
  // table, and the callers ask once per visible contig.
  setup = cachedSetup({
    setup: async (opts: BaseOptions) => {
      const records = await this.setupPre(opts)
      return {
        records,
        byRefName: [
          indexRecordsByName(records, r => r.qseqid),
          indexRecordsByName(records, r => r.sseqid),
        ] as const,
      }
    },
  })

  async setupPre(opts?: BaseOptions): Promise<BlastRecord[]> {
    return collectLines({
      buffer: await fetchAndMaybeUnzip(
        openLocation(this.getConf('blastTableLocation'), this.pluginManager),
        opts,
      ),
      label: 'Parsing BLAST table',
      parseLine: createBlastLineParser(this.getConf('columns')),
      opts,
    })
  }

  async getRefNames(opts: BaseOptions = {}) {
    // Resolved before the setup: an assembly this adapter does not carry has
    // the same answer whatever the file says, and reading it first was
    // downloading and parsing the whole table to return [].
    const sides = this.facingSides(opts.assemblyName)
    if (sides.length === 0) {
      return []
    }
    const { byRefName } = await this.setup(opts)
    return [...new Set(sides.flatMap(side => [...byRefName[side].keys()]))]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const {
        refName: queryRefName,
        assemblyName: queryAssemblyName,
        start: queryStart,
        end: queryEnd,
      } = query
      const sides = this.facingSides(queryAssemblyName)
      if (sides.length === 0) {
        console.warn(`${queryAssemblyName} not found in this adapter`)
        observer.complete()
        return
      }
      const { records, byRefName } = await this.setup(opts)
      const notYetEmitted = this.createSideDedupe(sides)

      // Both sides only for a self-alignment, where a hit's two ends are each
      // other's mate and the queried contig can be named by either column.
      for (const side of sides) {
        const flip = side === 0
        const mateAssemblyName = this.mateAssemblyName(side)

        // Only the hits anchored on the queried contig, walked in ascending
        // record index so features still arrive in file order.
        for (const i of byRefName[side].get(queryRefName) ?? []) {
          const { qseqid, sseqid, qstart, qend, sstart, send, ...rest } =
            records[i]!
          const anchor = flip
            ? orientBlastSide(qstart, qend)
            : orientBlastSide(sstart, send)
          if (doesIntersect2(queryStart, queryEnd, anchor.start, anchor.end)) {
            const mate = flip
              ? orientBlastSide(sstart, send)
              : orientBlastSide(qstart, qend)
            const refName = flip ? qseqid : sseqid
            const mateRefName = flip ? sseqid : qseqid
            const strand = anchor.strand * mate.strand
            const identity = blastIdentity(rest.pident)
            if (
              notYetEmitted({
                refName,
                start: anchor.start,
                end: anchor.end,
                strand,
                mateRefName,
                mateStart: mate.start,
                mateEnd: mate.end,
                // tblastx puts a region's two frames on one drawn geometry at
                // different identities, and both belong on screen
                identity,
              })
            ) {
              observer.next(
                new SyntenyFeature({
                  // the perspective is part of the identity: a self-alignment
                  // serves one hit from both ends against one assembly name
                  uniqueId: `${i}-${flip ? 'q' : 's'}-${queryAssemblyName}`,
                  assemblyName: queryAssemblyName,
                  start: anchor.start,
                  end: anchor.end,
                  type: 'match',
                  refName,
                  strand,
                  syntenyId: i,
                  identity,
                  ...rest,
                  mate: {
                    start: mate.start,
                    end: mate.end,
                    refName: mateRefName,
                    assemblyName: mateAssemblyName,
                  },
                }),
              )
            }
          }
        }
      }

      observer.complete()
    })
  }
}
