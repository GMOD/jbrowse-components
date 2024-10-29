import { unzip } from '@gmod/bgzf-filehandle'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import PluginManager from '@jbrowse/core/PluginManager'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { doesIntersect2, Feature, isGzip, Region } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { parseLineByLine } from '../util'
import BlastTabularAdapterConfigType from './configSchema'
import SyntenyFeature from '../SyntenyFeature'

type BlastTabularAdapterConfig = ReturnType<
  typeof BlastTabularAdapterConfigType.create
>

// Blast output column names/descriptions taken from
// https://www.ncbi.nlm.nih.gov/books/NBK279684/#_appendices_Options_for_the_commandline_a_
interface BlastRecord {
  /** Query Seq-id */
  qseqid: string
  /** Subject Seq-id */
  sseqid: string
  /** Percentage of identical matches */
  pident: number
  /** Alignment length */
  length: number
  /** Number of mismatches */
  mismatch: number
  /** Number of gap openings */
  gapopen: number
  /** Start of alignment in query */
  qstart: number
  /** End of alignment in query */
  qend: number
  /** Start of alignment in subject */
  sstart: number
  /** End of alignment in subject */
  send: number
  /** Expect value */
  evalue: number
  /** Bit score */
  bitscore: number
}

export function parseBlastLine(line: string): BlastRecord | undefined {
  const [
    qseqid,
    sseqid,
    pident,
    length,
    mismatch,
    gapopen,
    qstart,
    qend,
    sstart,
    send,
    evalue,
    bitscore,
  ] = line.split('\t')

  if (
    !(
      qseqid &&
      sseqid &&
      pident &&
      length &&
      mismatch &&
      gapopen &&
      qstart &&
      qend &&
      sstart &&
      send &&
      evalue &&
      bitscore
    )
  ) {
    console.warn('Invalid BLAST line')
    console.warn(line)
    return
  }

  return {
    qseqid,
    sseqid,
    pident: Number.parseFloat(pident),
    length: Number.parseInt(length, 10),
    mismatch: Number.parseInt(mismatch, 10),
    gapopen: Number.parseInt(gapopen, 10),
    qstart: Number.parseInt(qstart, 10),
    qend: Number.parseInt(qend, 10),
    sstart: Number.parseInt(sstart, 10),
    send: Number.parseInt(send, 10),
    evalue: Number.parseFloat(evalue),
    bitscore: Number.parseFloat(bitscore),
  }
}

export default class BlastTabularAdapter extends BaseFeatureDataAdapter {
  private data: Promise<BlastRecord[]>

  public static capabilities = ['getFeatures', 'getRefNames']

  constructor(
    public config: BlastTabularAdapterConfig,
    public getSubAdapter?: getSubAdapterType,
    public pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.data = this.setup(config)
  }

  async setup(config: BlastTabularAdapterConfig): Promise<BlastRecord[]> {
    const pm = this.pluginManager
    const blastTableLocation = openLocation(
      readConfObject(config, 'blastTableLocation'),
      pm,
    )
    const buffer = await blastTableLocation.readFile()
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    return parseLineByLine(buf, parseBlastLine)
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
    const feats = await this.data

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

  getFeatures(query: Region) {
    return ObservableCreate<Feature>(async observer => {
      const blastRecords = await this.data
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
        let start,
          end,
          refName,
          assemblyName,
          mateStart,
          mateEnd,
          mateRefName,
          mateAssemblyName

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
