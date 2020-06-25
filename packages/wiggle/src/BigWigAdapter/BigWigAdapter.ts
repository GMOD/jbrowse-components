import { BigWig, Feature as BBIFeature } from '@gmod/bbi'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@gmod/jbrowse-core/util/types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@gmod/jbrowse-core/util/QuickLRU'
import { map, mergeAll } from 'rxjs/operators'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { Instance } from 'mobx-state-tree'
import {
  blankStats,
  rectifyStats,
  scoresToStats,
  UnrectifiedFeatureStats,
  DataAdapterWithGlobalStats,
} from '../statsUtil'

import configSchema from './configSchema'

interface StatsRegion {
  refName: string
  start: number
  end: number
  bpPerPx?: number
}

class MyCache {
  private fill: Function

  constructor({ fill }) {
    this.fill = fill
  }

  get(key, params) {
    console.log('here', params)
    return this.fill(params)
  }
}

export default class BigWigAdapter extends BaseFeatureDataAdapter
  implements DataAdapterWithGlobalStats {
  private bigwig: BigWig

  private statsCache = new MyCache({
    cache: new QuickLRU({ maxSize: 1000 }),
    fill: async (
      args: {
        refName: string
        start: number
        end: number
        bpPerPx?: number
        headers: Record<string, string>
      },
      abortSignal?: AbortSignal,
    ) => {
      console.log('testing')
      const { refName, start, end, bpPerPx, headers } = args
      const feats = this.getFeatures(
        { refName, start, end },
        {
          signal: abortSignal,
          basesPerSpan: bpPerPx,
          headers,
        },
      )
      return scoresToStats({ refName, start, end }, feats)
    },
  })

  public constructor(config: Instance<typeof configSchema>) {
    super(config)
    this.bigwig = new BigWig({
      filehandle: openLocation(readConfObject(config, 'bigWigLocation')),
    })
  }

  public async getRefNames() {
    const header = await this.bigwig.getHeader()
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number) {
    const h = await this.bigwig.getHeader()
    return (h.refsByNumber[refId] || { name: undefined }).name
  }

  public async getGlobalStats(opts: BaseOptions = {}) {
    console.log('getGlobalStats')
    const header = await this.bigwig.getHeader(opts.signal)
    return rectifyStats(header.totalSummary as UnrectifiedFeatureStats)
  }

  // todo: incorporate summary blocks
  public getRegionStats(region: NoAssemblyRegion, opts: BaseOptions = {}) {
    console.log('getRegionStats')
    const { refName, start, end } = region
    const { bpPerPx, signal, headers } = opts
    return this.statsCache.get(
      `${refName}_${start}_${end}_${bpPerPx}`,
      { refName, start, end, bpPerPx, headers },
      signal,
    )
  }

  // todo: add caching
  public async getMultiRegionStats(
    regions: NoAssemblyRegion[] = [],
    opts: BaseOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }
    const feats = await Promise.all(
      regions.map(r => this.getRegionStats(r, opts)),
    )

    const scoreMax = feats
      .map(s => s.scoreMax)
      .reduce((acc, curr) => Math.max(acc, curr))
    const scoreMin = feats
      .map(s => s.scoreMin)
      .reduce((acc, curr) => Math.min(acc, curr))
    const scoreSum = feats.map(s => s.scoreSum).reduce((a, b) => a + b, 0)
    const scoreSumSquares = feats
      .map(s => s.scoreSumSquares)
      .reduce((a, b) => a + b, 0)
    const featureCount = feats
      .map(s => s.featureCount)
      .reduce((a, b) => a + b, 0)
    const basesCovered = feats
      .map(s => s.basesCovered)
      .reduce((a, b) => a + b, 0)

    return rectifyStats({
      scoreMin,
      scoreMax,
      featureCount,
      basesCovered,
      scoreSumSquares,
      scoreSum,
    })
  }

  public getFeatures(region: NoAssemblyRegion, opts: BaseOptions = {}) {
    const { refName, start, end } = region
    const { signal, bpPerPx, headers } = opts
    return ObservableCreate<Feature>(async observer => {
      const ob = await this.bigwig.getFeatureStream(refName, start, end, {
        signal,
        basesPerSpan: bpPerPx,
        headers,
      })
      ob.pipe(
        mergeAll(),
        map((record: BBIFeature) => {
          return new SimpleFeature({
            id: String(record.start + 1),
            data: record,
          })
        }),
      ).subscribe(observer)
    }, opts.signal)
  }

  public freeResources(): void {}
}
