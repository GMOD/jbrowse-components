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

import type { PairwiseAssemblyConfigModel } from '../pairwiseAssemblyFields.ts'
import type { PAFAdapterConfig } from './configSchema.ts'
import type { PAFRecord } from './util.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Every adapter whose file reads as PAF records: PAF itself, and the delta,
 * chain and MashMap formats, which each supply only `setupPre` and read its
 * file off their own config.
 */
export abstract class PafRecordsAdapter<
  CONF extends PairwiseAssemblyConfigModel,
> extends PairwiseAdapterBase<CONF> {
  // One download+parse shared by every display on this track, reporting to
  // whichever of them is currently waiting, plus the per-refName index every
  // query walks.
  setup = cachedSetup({
    setup: async (opts: BaseOptions) => {
      const records = await this.setupPre(opts)
      opts.statusCallback?.('Processing alignments')
      return { records, byRefName: indexPafRecords(records) }
    },
  })

  abstract setupPre(opts?: BaseOptions): Promise<PAFRecord[]>

  async getRefNames(opts: BaseOptions = {}) {
    return this.facingRefNames(
      opts.assemblyName,
      async () => (await this.setup(opts)).byRefName,
    )
  }

  async getContigs(opts: BaseOptions = {}) {
    return this.facingContigs(opts.assemblyName, async side => {
      const { records, byRefName } = await this.setup(opts)
      return new Map(
        [...byRefName[side]].map(([refName, rows]) => [
          refName,
          rows
            .map(i => (side === 0 ? records[i]!.qlen : records[i]!.tlen))
            .find(length => length !== undefined && Number.isFinite(length)),
        ]),
      )
    })
  }

  async getContigLengths(side: 0 | 1, opts: BaseOptions = {}) {
    const { records, byRefName } = await this.setup(opts)
    const lengths = new Map<string, number>()
    for (const [refName, rows] of byRefName[side]) {
      let length = 0
      for (const i of rows) {
        const r = records[i]!
        const stated = side === 0 ? r.qlen : r.tlen
        const reached = side === 0 ? r.qend : r.tend
        length = Math.max(
          length,
          stated !== undefined && Number.isFinite(stated) ? stated : reached,
        )
      }
      lengths.set(refName, length)
    }
    return lengths
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const sides = this.queriedSides(assemblyName)
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

export default class PAFAdapter extends PafRecordsAdapter<PAFAdapterConfig> {
  async setupPre(opts?: BaseOptions) {
    return loadPafRecords({
      file: openLocation(this.getConf('pafLocation'), this.pluginManager),
      parse: parsePafBuffer,
      opts,
    })
  }
}
