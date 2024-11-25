import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { doesIntersect2, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature'
import { parseLineByLine } from '../util'
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

function createBlastLineParser(columns: string) {
  const columnNames = columns.trim().split(' ') as (keyof BlastRecord)[]
  const qseqidIndex = columnNames.indexOf('qseqid')
  if (qseqidIndex === -1) {
    throw new Error('Missing required column "qseqid"')
  }
  const sseqidIndex = columnNames.indexOf('sseqid')
  if (sseqidIndex === -1) {
    throw new Error('Missing required column "sseqid"')
  }
  const qstartIndex = columnNames.indexOf('qstart')
  if (qstartIndex === -1) {
    throw new Error('Missing required column "qstart"')
  }
  const qendIndex = columnNames.indexOf('qend')
  if (qendIndex === -1) {
    throw new Error('Missing required column "qend"')
  }
  const sstartIndex = columnNames.indexOf('sstart')
  if (sstartIndex === -1) {
    throw new Error('Missing required column "sstart"')
  }
  const sendIndex = columnNames.indexOf('send')
  if (sendIndex === -1) {
    throw new Error('Missing required column "send"')
  }
  const columnNameSet = new Map<string, number>(
    columnNames
      .map((c, idx) => [c, idx] as const)
      .filter(
        f =>
          !['qseqid', 'sseqid', 'qstart', 'qend', 'sstart', 'send'].includes(
            f[0],
          ),
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
    for (const [columnName, idx] of columnNameSet.entries()) {
      const value = row[idx]
      if (!value) {
        continue
      }
      // @ts-expect-error
      record[columnName] = value
    }
    return record
  }
}

export default class BlastTabularAdapter extends BaseFeatureDataAdapter {
  private data: Promise<BlastRecord[]> | undefined

  public static capabilities = ['getFeatures', 'getRefNames']

  getData(opts?: BaseOptions): Promise<BlastRecord[]> {
    if (!this.data) {
      this.data = this.setup(opts).catch((e: unknown) => {
        this.data = undefined
        throw e
      })
    }
    return this.data
  }

  async setup(opts?: BaseOptions): Promise<BlastRecord[]> {
    const pm = this.pluginManager
    const buf = await fetchAndMaybeUnzip(
      openLocation(readConfObject(this.config, 'blastTableLocation'), pm),
      opts,
    )
    const columns: string = readConfObject(this.config, 'columns')
    return parseLineByLine(buf, createBlastLineParser(columns))
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    if (assemblyNames.length === 0) {
      const query = this.getConf('queryAssembly') as string
      const target = this.getConf('targetAssembly') as string
      return [query, target]
    }
    return assemblyNames
  }

  async getRefNames(opts: BaseOptions = {}) {
    // @ts-expect-error
    const r1 = opts.regions?.[0].assemblyName
    const feats = await this.getData(opts)

    const idx = this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (const feat of feats) {
        set.add(idx === 0 ? feat.qseqid : feat.sseqid)
      }
      return [...set]
    }
    console.warn('Unable to do ref renaming on adapter')
    return []
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const blastRecords = await this.getData(opts)
      const [queryAssembly, targetAssembly] = this.getAssemblyNames()

      // The index of the assembly name in the query list corresponds to the
      // adapter in the subadapters list
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
        observer.complete()
        return
      }

      for (let i = 0; i < blastRecords.length; i++) {
        const r = blastRecords[i]!
        let start: number
        let end: number
        let refName: string
        let assemblyName: string | undefined
        let mateStart: number
        let mateEnd: number
        let mateRefName: string
        let mateAssemblyName: string | undefined

        const { qseqid, sseqid, qstart, qend, sstart, send, ...rest } = r
        if (queryAssemblyName === queryAssembly) {
          start = qstart
          end = qend
          refName = qseqid
          assemblyName = queryAssembly
          mateStart = sstart
          mateEnd = send
          mateRefName = sseqid
          mateAssemblyName = targetAssembly
        } else {
          start = sstart
          end = send
          refName = sseqid
          assemblyName = targetAssembly
          mateStart = qstart
          mateEnd = qend
          mateRefName = qseqid
          mateAssemblyName = queryAssembly
        }
        let strand = 1
        let mateStrand = 1
        if (start > end) {
          ;[start, end] = [end, start]
          strand = -1
        }
        if (mateStart > mateEnd) {
          ;[mateStart, mateEnd] = [mateEnd, mateStart]
          mateStrand = -1
        }
        if (
          refName === queryRefName &&
          doesIntersect2(queryStart, queryEnd, start, end)
        ) {
          observer.next(
            new SyntenyFeature({
              uniqueId: i + queryAssemblyName,
              assemblyName,
              start,
              end,
              type: 'match',
              refName,
              strand: strand * mateStrand,
              syntenyId: i,
              ...rest,
              mate: {
                start: mateStart,
                end: mateEnd,
                refName: mateRefName,
                assemblyName: mateAssemblyName,
              },
            }),
          )
        }
      }

      observer.complete()
    })
  }

  freeResources(/* { query } */): void {}
}
