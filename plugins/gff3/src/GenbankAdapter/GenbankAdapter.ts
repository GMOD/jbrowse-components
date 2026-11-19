import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  makeFeatureIntervalTreeMap,
  refNameRecord,
} from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { Gff3Feature } from '../Gff3Feature.ts'
import { genbankFeatures } from '../genbank/genbankFeatures.ts'
import { parseRecords } from '../genbank/parseGenbank.ts'
import { searchAcrossOrigin } from '../originSpanning.ts'

import type { GenbankAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class GenbankAdapter extends BaseFeatureDataAdapter<GenbankAdapterConfig> {
  private loadData = cachedSetup({
    setup: async (opts: BaseOptions) => {
      const text = await fetchAndMaybeUnzipText(
        openLocation(this.getConf('genbankLocation'), this.pluginManager),
        opts,
      )
      const records = refNameRecord<{ length: number; circular: boolean }>()
      const linesByRef = refNameRecord<string[]>()
      for (const { refName, length, circular, featureLines } of parseRecords(
        text,
      )) {
        records[refName] = { length, circular }
        linesByRef[refName] = featureLines
      }
      const intervalTreeMap = makeFeatureIntervalTreeMap(
        linesByRef,
        (lines, refName) =>
          genbankFeatures(
            lines,
            refName,
            records[refName]?.length ?? 0,
            records[refName]?.circular ?? false,
          ),
        'Parsing GenBank data',
      )
      return { intervalTreeMap, records }
    },
  })

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData(opts)
    return Object.keys(intervalTreeMap)
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { intervalTreeMap, records } = await this.loadData(opts)
      const record = records[query.refName]
      const tree = intervalTreeMap[query.refName]?.(opts.statusCallback)
      if (record && tree) {
        for (const { feature, uniqueId } of searchAcrossOrigin(
          tree,
          query,
          record.circular ? record.length : undefined,
          opts.wholeAcrossOrigin,
        )) {
          observer.next(new Gff3Feature(feature, uniqueId))
        }
      }
      observer.complete()
    }, opts.signal)
  }
}
