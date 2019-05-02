import { BigWig } from '@gmod/bbi'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from 'quick-lru'
import { Observable,from } from 'rxjs'
import { mergeMap,concatAll, map } from 'rxjs/operators'

import BaseAdapter, {Region} from '@gmod/jbrowse-core/BaseAdapter'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'

import { rectifyStats, scoresToStats } from './util'

export default class BigWigAdapter extends BaseAdapter {
  private bigwig: BigWig
  private statsCache: AbortablePromiseCache

  static capabilities = ['getFeatures', 'getRefNames']

  constructor(config) {
    super(config)
    this.bigwig = new BigWig({
      filehandle: openLocation(config.bigWigLocation),
    })
    const bigwigRef = this.bigwig
    this.statsCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: 1000 }),
      async fill(region, abortSignal) {
        const { refName, start, end, bpPerPx } = region
        const feats = await bigwigRef.getFeatures(refName, start, end, {
          signal: abortSignal,
          basesPerSpan: (bpPerPx * 20) / Math.log(end - start),
        })
        return scoresToStats(region, feats)
      },
    })
  }

  async getRefNames() {
    const header = await this.bigwig.getHeader()
    return Object.keys(header.refsByName)
  }

  async refIdToName(refId) {
    return ((await this.bigwig.getHeader()).refsByNumber[refId] || {}).name
  }

  async getGlobalStats(abortSignal) {
    const header = await this.bigwig.getHeader(abortSignal)
    return header.totalSummary
  }

  // todo: incorporate summary blocks
  getRegionStats(region, abortSignal) {
    const { refName, start, end, bpPerPx } = region
    return this.statsCache.get(
      `${refName}_${start}_${end}_${bpPerPx}`,
      region,
      abortSignal,
    )
  }

  // todo: add caching
  async getMultiRegionStats(regions = [], abortSignal) {
    if (!regions.length) return undefined
    const feats = await Promise.all(
      regions.map(r => this.getRegionStats(r, abortSignal)),
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

  getFeatures({ /* assembly, */ refName, start, end }:Region, {signal, bpPerPx}) {
    return ObservableCreate(async observer => {
      const observable2 = await this.bigwig.getFeatureStream(
        refName,
        start,
        end,
        {
          signal,
          basesPerSpan: (bpPerPx * 20) / Math.log(end - start),
        },
      )
      return observable2
        .pipe(
          mergeMap(x => from(x)),
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
