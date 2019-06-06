import { BigWig, Feature as BBIFeature } from '@gmod/bbi'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from 'quick-lru'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { Observable, Observer } from 'rxjs'
import { mergeAll, map } from 'rxjs/operators'

import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { openLocation, FileLocation } from '@gmod/jbrowse-core/util/io'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'

import {
  rectifyStats,
  scoresToStats,
  blankStats,
  UnrectifiedFeatureStats,
  FeatureStats,
} from './util'

interface StatsRegion {
  refName: string
  start: number
  end: number
  bpPerPx?: number
}

export default class BigWigAdapter extends BaseAdapter {
  private bigwig: BigWig

  private statsCache: {
    get: (
      key: string,
      region: StatsRegion,
      signal?: AbortSignal,
    ) => Promise<FeatureStats>
  }

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: { bigWigLocation: FileLocation }) {
    super()
    this.bigwig = new BigWig({
      filehandle: openLocation(config.bigWigLocation),
    })
    const bigwigRef = this.bigwig
    this.statsCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: 1000 }),
      async fill(
        args: { refName: string; start: number; end: number; bpPerPx: number },
        abortSignal: AbortSignal,
      ) {
        const { refName, start, end, bpPerPx } = args
        const feats = await bigwigRef.getFeatures(refName, start, end, {
          signal: abortSignal,
          basesPerSpan: bpPerPx,
        })
        return scoresToStats({ refName, start, end }, feats)
      },
    })
  }

  public async getRefNames(): Promise<string[]> {
    const header = await this.bigwig.getHeader()
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number): Promise<string | undefined> {
    const h = await this.bigwig.getHeader()
    // @ts-ignore wants indexer or true map object
    return (h.refsByNumber[refId] || { name: undefined }).name
  }

  public async getGlobalStats(opts: BaseOptions = {}): Promise<FeatureStats> {
    const header = await this.bigwig.getHeader(opts.signal)
    return rectifyStats(header.totalSummary as UnrectifiedFeatureStats)
  }

  // todo: incorporate summary blocks
  public getRegionStats(
    region: IRegion,
    opts: BaseOptions = {},
  ): Promise<FeatureStats> {
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
    regions: IRegion[] = [],
    opts: BaseOptions = {},
  ): Promise<FeatureStats> {
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
    region: IRegion,
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
