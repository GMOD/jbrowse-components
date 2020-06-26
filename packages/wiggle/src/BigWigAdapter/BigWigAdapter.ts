import { BigWig, Feature as BBIFeature } from '@gmod/bbi'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@gmod/jbrowse-core/util/types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
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

export default class BigWigAdapter extends BaseFeatureDataAdapter
  implements DataAdapterWithGlobalStats {
  private bigwig: BigWig

  public constructor(config: Instance<typeof configSchema>) {
    super(config)
    this.bigwig = new BigWig({
      filehandle: openLocation(readConfObject(config, 'bigWigLocation')),
    })
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const header = await this.bigwig.getHeader(opts)
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number) {
    const h = await this.bigwig.getHeader()
    return (h.refsByNumber[refId] || { name: undefined }).name
  }

  public async getGlobalStats(opts: BaseOptions = {}) {
    const header = await this.bigwig.getHeader(opts)
    return rectifyStats(header.totalSummary as UnrectifiedFeatureStats)
  }

  // todo: incorporate summary blocks
  public getRegionStats(region: NoAssemblyRegion, opts: BaseOptions = {}) {
    const feats = this.getFeatures(region, opts)
    return scoresToStats(region, feats)
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
      regions.map(region => this.getRegionStats(region, opts)),
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
