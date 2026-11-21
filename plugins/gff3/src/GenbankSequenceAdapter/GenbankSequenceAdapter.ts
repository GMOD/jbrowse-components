import { parseRecords, recordSequence } from '@jbrowse/add-track-core'
import {
  BaseSequenceAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { GenbankSequenceAdapterConfig } from './configSchema.ts'
import type {
  BaseOptions,
  SequenceRegion,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class GenbankSequenceAdapter extends BaseSequenceAdapter<GenbankSequenceAdapterConfig> {
  private setup = cachedSetup({
    setup: async (opts: BaseOptions) => {
      const text = await fetchAndMaybeUnzipText(
        openLocation(this.getConf('genbankLocation'), this.pluginManager),
        opts,
        'Downloading sequence',
      )
      return new Map(
        parseRecords(text).map(record => [
          record.refName,
          { sequence: recordSequence(record), circular: record.circular },
        ]),
      )
    },
  })

  public async getRefNames(opts: BaseOptions = {}) {
    const records = await this.setup(opts)
    return [...records.keys()]
  }

  public async getRegions(opts: BaseOptions = {}) {
    const records = await this.setup(opts)
    const regions: SequenceRegion[] = [...records.entries()].map(
      ([refName, { sequence, circular }]) => ({
        refName,
        start: 0,
        end: sequence.length,
        ...(circular ? { circular } : {}),
      }),
    )
    return regions
  }

  public getFeatures(
    { refName, start, end }: NoAssemblyRegion,
    opts: BaseOptions = {},
  ) {
    return ObservableCreate<Feature>(async observer => {
      const records = await this.setup(opts)
      const seq = records.get(refName)?.sequence.slice(start, end)
      if (seq) {
        observer.next(
          new SimpleFeature({
            id: `${refName}-${start}-${start + seq.length}`,
            data: { refName, start, end: start + seq.length, seq },
          }),
        )
      }
      observer.complete()
    }, opts.signal)
  }
}
