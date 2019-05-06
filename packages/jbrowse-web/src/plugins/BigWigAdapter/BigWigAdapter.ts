import { BigWig, Statistics } from '@gmod/bbi'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from 'quick-lru'
import { Observable, Observer, of } from 'rxjs'
import { mergeMap, mergeAll, map, tap } from 'rxjs/operators'

import BaseAdapter, {
  BaseOptions,
  Region,
} from '@gmod/jbrowse-core/BaseAdapter'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'

import { rectifyStats, scoresToStats, blankStats } from './util'

interface FeatureStats {
  scoreMin: number
  scoreMax: number
  scoreMean: number
  scoreSum: number
  scoreStdDev: number
  featureDensity: number
  scoreSumSquares: number
  featureCount: number
  basesCovered: number
}

export default class BigWigAdapter extends BaseAdapter {
  private bigwig: BigWig

  private statsCache: any

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: Record<string, any>) {
    super(config)
    this.bigwig = new BigWig({
      filehandle: openLocation(config.bigWigLocation),
    })
    const bigwigRef = this.bigwig
    this.statsCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: 1000 }),
      async fill(region: Region, abortSignal: AbortSignal) {
        const { refName, start, end } = region
        const feats = await bigwigRef.getFeatures(refName, start, end, {
          signal: abortSignal,
          basesPerSpan: end - start,
        })
        return scoresToStats(region, feats)
      },
    })
  }

  public async getRefNames(): Promise<string[]> {
    const header = await this.bigwig.getHeader()
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number): Promise<string | undefined> {
    const h = await this.bigwig.getHeader()
    return (h.refsByNumber.get(refId) || { name: undefined }).name
  }

  public async getGlobalStats(opts: BaseOptions = {}): Promise<FeatureStats> {
    const header = await this.bigwig.getHeader(opts.signal)
    return rectifyStats(header.totalSummary)
  }

  // todo: incorporate summary blocks
  public getRegionStats(
    region: Region,
    opts: BaseOptions = {},
  ): Promise<FeatureStats> {
    const { refName, start, end, bpPerPx } = region
    return this.statsCache.get(
      `${refName}_${start}_${end}_${bpPerPx}`,
      region,
      opts.signal,
    )
  }

  // todo: add caching
  public async getMultiRegionStats(
    regions: Region[] = [],
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
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */

  public getFeatures(
    { /* assembly, */ refName, start, end }: Region,
    opts: BaseOptions = {},
  ) {
    const { signal } = opts
    return ObservableCreate(async (observer: Observer<Feature>) => {
      const observable2 = await this.bigwig.getFeatureStream(
        refName,
        start,
        end,
        {
          signal,
          basesPerSpan: end - start,
        },
      )
      return observable2
        .pipe(
          tap(items => console.log('before', items)),
          mergeAll(),
          tap(items => console.log('after', items)),
          map(record => {
            return new SimpleFeature({
              id: record.start + 1,
              data: record,
            })
          }),
        )
        .subscribe(observer)
    })
  }
}
