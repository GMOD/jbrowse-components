import { createSharedSetup } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { ComparativeAdapterBase } from '../ComparativeAdapterBase.ts'
import { getAssemblyNamesFromConf } from '../util.ts'
import {
  indexPafRecords,
  loadPafRecords,
  makeSyntenyFeature,
  orientPafRecord,
  parsePafBuffer,
} from './util.ts'

import type { PAFRecord } from './util.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export default class PAFAdapter extends ComparativeAdapterBase {
  // One download+parse shared by every display on this track, reporting to
  // whichever of them is currently waiting, plus the per-refName index every
  // query walks. Subclasses (delta, chain, MashMap) override setupPre alone, so
  // they are indexed too.
  setup = createSharedSetup(async (opts: BaseOptions) => {
    const records = await this.setupPre(opts)
    opts.statusCallback?.('Indexing alignments by contig')
    return { records, byRefName: indexPafRecords(records) }
  })

  async setupPre(opts?: BaseOptions): Promise<PAFRecord[]> {
    return loadPafRecords({
      file: openLocation(this.getConf('pafLocation'), this.pluginManager),
      parse: parsePafBuffer,
      opts,
    })
  }

  getAssemblyNames(): string[] {
    return getAssemblyNamesFromConf(this)
  }

  // Which side of the file an assembly is anchored on: 0 = the PAF query
  // (qname) columns, 1 = the target (tname) columns, -1 = not ours. Indexes
  // `byRefName` directly, and `flip` (the query perspective) is side 0.
  // Anything past the second name reads as the target side, which is what the
  // positional indexOf has always done.
  private sideFor(assemblyName: string | undefined): 0 | 1 | -1 {
    const idx =
      assemblyName === undefined
        ? -1
        : this.getAssemblyNames().indexOf(assemblyName)
    return idx === -1 ? -1 : idx === 0 ? 0 : 1
  }

  async getRefNames(opts: BaseOptions = {}) {
    // Resolved before the setup: an assembly this adapter does not carry has
    // the same answer whatever the file says, and reading it first was
    // downloading and parsing a whole PAF to return [].
    const side = this.sideFor(opts.assemblyName)
    if (side === -1) {
      return []
    }
    const { byRefName } = await this.setup(opts)
    return [...byRefName[side].keys()]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const side = this.sideFor(assemblyName)
      if (side === -1) {
        console.warn(`${assemblyName} not found in this adapter`)
        observer.complete()
        return
      }
      const { records, byRefName } = await this.setup(opts)
      const assemblyNames = this.getAssemblyNames()

      // if the getFeatures::query is on the query assembly, flip orientation
      // of data
      const flip = side === 0
      const mateAssemblyName = assemblyNames[flip ? 1 : 0]!

      // Only the rows anchored on the queried contig, rather than the whole
      // file per region — see indexRecordsByName. Walked in ascending record
      // index, so features still arrive in file order.
      for (const i of byRefName[side].get(qref) ?? []) {
        const record = records[i]!
        const { refName, start, end, mateRefName, mateStart, mateEnd } =
          orientPafRecord(record, flip)
        if (doesIntersect2(qstart, qend, start, end)) {
          observer.next(
            makeSyntenyFeature({
              syntenyId: i,
              assemblyName,
              refName,
              start,
              end,
              strand: record.strand,
              extra: record.extra,
              flip,
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
}
