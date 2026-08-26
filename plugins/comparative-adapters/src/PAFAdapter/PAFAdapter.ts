import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { PairwiseAdapterBase } from '../PairwiseAdapterBase.ts'
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

export default class PAFAdapter extends PairwiseAdapterBase {
  // One download+parse shared by every display on this track, reporting to
  // whichever of them is currently waiting, plus the per-refName index every
  // query walks. Subclasses (delta, chain, MashMap) override setupPre alone, so
  // they are indexed too.
  setup = cachedSetup({
    setup: async (opts: BaseOptions) => {
      const records = await this.setupPre(opts)
      opts.statusCallback?.('Indexing alignments by contig')
      return { records, byRefName: indexPafRecords(records) }
    },
  })

  async setupPre(opts?: BaseOptions): Promise<PAFRecord[]> {
    return loadPafRecords({
      file: openLocation(this.getConf('pafLocation'), this.pluginManager),
      parse: parsePafBuffer,
      opts,
    })
  }

  async getRefNames(opts: BaseOptions = {}) {
    // Resolved before the setup: an assembly this adapter does not carry has
    // the same answer whatever the file says, and reading it first was
    // downloading and parsing a whole PAF to return [].
    const sides = this.facingSides(opts.assemblyName)
    if (sides.length === 0) {
      return []
    }
    const { byRefName } = await this.setup(opts)
    return [...new Set(sides.flatMap(side => [...byRefName[side].keys()]))]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const sides = this.facingSides(assemblyName)
      if (sides.length === 0) {
        console.warn(`${assemblyName} not found in this adapter`)
        observer.complete()
        return
      }
      const { records, byRefName } = await this.setup(opts)
      const notYetEmitted = this.createSideDedupe(sides)

      // Both sides only for a self-alignment, where each end of a duplicated
      // block is the other's mate and the queried contig can be named by either
      // column.
      for (const side of sides) {
        // if the getFeatures::query is on the query assembly, flip orientation
        // of data
        const flip = side === 0
        const mateAssemblyName = this.mateAssemblyName(side)

        // Only the rows anchored on the queried contig, rather than the whole
        // file per region — see indexRecordsByName. Walked in ascending record
        // index, so features still arrive in file order.
        for (const i of byRefName[side].get(qref) ?? []) {
          const record = records[i]!
          const { refName, start, end, mateRefName, mateStart, mateEnd } =
            orientPafRecord(record, flip)
          if (
            doesIntersect2(qstart, qend, start, end) &&
            notYetEmitted({
              refName,
              start,
              end,
              strand: record.strand,
              mateRefName,
              mateStart,
              mateEnd,
            })
          ) {
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
      }

      observer.complete()
    })
  }
}
