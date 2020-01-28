import { BigWig, Feature as BBIFeature } from '@gmod/bbi'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@gmod/jbrowse-core/util/QuickLRU'
import { Observable, Observer } from 'rxjs'
import { map, mergeAll, toArray } from 'rxjs/operators'
import {
  blankStats,
  FeatureStats,
  rectifyStats,
  scoresToStats,
  UnrectifiedFeatureStats,
} from '../statsUtil'

interface StatsRegion {
  refName: string
  start: number
  end: number
  bpPerPx?: number
}

export default class extends BaseAdapter {
  private bigwig: BigWig

  private statsCache: {
    get: (
      key: string,
      region: StatsRegion,
      signal?: AbortSignal,
    ) => Promise<FeatureStats>
  }

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: { bigWigLocation: IFileLocation }) {
    super()
    this.bigwig = new BigWig({
      filehandle: openLocation(config.bigWigLocation),
    })
    this.statsCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: 1000 }),
      fill: async (
        args: { refName: string; start: number; end: number; bpPerPx: number },
        abortSignal: AbortSignal,
      ): Promise<FeatureStats> => {
        const { refName, start, end, bpPerPx } = args
        const feats = await this.getFeatures(
          { refName, start, end },
          {
            signal: abortSignal,
            basesPerSpan: bpPerPx,
          },
        )
        const featsArray = await feats.pipe(toArray()).toPromise()
        return scoresToStats({ refName, start, end }, featsArray)
      },
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
    const header = await this.bigwig.getHeader(opts.signal)
    return rectifyStats(header.totalSummary as UnrectifiedFeatureStats)
  }

  // todo: incorporate summary blocks
  public getRegionStats(region: INoAssemblyRegion, opts: BaseOptions = {}) {
    const { refName, start, end } = region
    const { bpPerPx, signal } = opts
    return this.statsCache.get(
      `${refName}_${start}_${end}_${bpPerPx}`,
      { refName, start, end, bpPerPx },
      signal,
    )
  }

  // todo: add caching
  public async getMultiRegionStats(
    regions: INoAssemblyRegion[] = [],
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

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(
    region: INoAssemblyRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    const { refName, start, end } = region
    const { signal, bpPerPx } = opts
    return ObservableCreate<Feature>(async (observer: Observer<Feature>) => {
      const ob = await this.bigwig.getFeatureStream(refName, start, end, {
        signal,
        basesPerSpan: bpPerPx,
      })
      ob.pipe(
        mergeAll(),
        map((record: BBIFeature) => {
          return new SimpleFeature({
            id: record.start + 1,
            data: record,
          })
        }),
      ).subscribe(observer)
    })
  }

  public freeResources(): void {}
}
