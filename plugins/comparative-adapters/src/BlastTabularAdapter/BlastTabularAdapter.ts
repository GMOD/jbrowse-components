import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  createSharedSetup,
  doesIntersect2,
  fetchAndMaybeUnzip,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import { collectLines, getAssemblyNamesFromConf } from '../util.ts'

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

export default class BlastTabularAdapter extends BaseFeatureDataAdapter<BlastTabularAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

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

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    return getAssemblyNamesFromConf(this)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const r1 = opts.assemblyName
    const feats = await this.setup(opts)

    const idx = r1 === undefined ? -1 : this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (const feat of feats) {
        set.add(idx === 0 ? feat.qseqid : feat.sseqid)
      }
      return [...set]
    }
    return []
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const blastRecords = await this.setup(opts)
      const [queryAssembly, targetAssembly] = this.getAssemblyNames()

      const {
        refName: queryRefName,
        assemblyName: queryAssemblyName,
        start: queryStart,
        end: queryEnd,
      } = query
      if (
        queryAssemblyName !== targetAssembly &&
        queryAssemblyName !== queryAssembly
      ) {
        console.warn(`${queryAssemblyName} not found in this adapter`)
      } else {
        const flip = queryAssemblyName === queryAssembly
        for (let i = 0; i < blastRecords.length; i++) {
          const { qseqid, sseqid, qstart, qend, sstart, send, ...rest } =
            blastRecords[i]!
          const refName = flip ? qseqid : sseqid
          const side = flip
            ? orientBlastSide(qstart, qend)
            : orientBlastSide(sstart, send)
          if (
            refName === queryRefName &&
            doesIntersect2(queryStart, queryEnd, side.start, side.end)
          ) {
            const mate = flip
              ? orientBlastSide(sstart, send)
              : orientBlastSide(qstart, qend)
            observer.next(
              new SyntenyFeature({
                uniqueId: i + queryAssemblyName,
                assemblyName: queryAssemblyName,
                start: side.start,
                end: side.end,
                type: 'match',
                refName,
                strand: side.strand * mate.strand,
                syntenyId: i,
                identity: blastIdentity(rest.pident),
                ...rest,
                mate: {
                  start: mate.start,
                  end: mate.end,
                  refName: flip ? sseqid : qseqid,
                  assemblyName: flip ? targetAssembly : queryAssembly,
                },
              }),
            )
          }
        }
      }

      observer.complete()
    })
  }
}
