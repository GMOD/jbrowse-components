import { BigWig } from '@gmod/bbi'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from 'quick-lru'
import BaseAdapter from '../../BaseAdapter'
import { openLocation } from '../../util/io'
import SimpleFeature from '../../util/simpleFeature'
import { ObservableCreate } from '../../util/rxjs'
import { calcStdFromSums, rectifyStats, scoresToStats } from './util'

export default class BigWigAdapter extends BaseAdapter {
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
        const { refName: ref, start, end } = region
        const feats = await bigwigRef.getFeatures(ref, start, end, abortSignal)
        const scores = feats.map(s => s.score)
        return scoresToStats(region, scores)
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
    const { refName, start, end } = region
    return this.statsCache.get(
      `${refName}_${start}_${end}`,
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

    const scoreMax = Math.max(...feats.map(s => s.scoreMax))
    const scoreMin = Math.min(...feats.map(s => s.scoreMin))
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

  getFeatures({ /* assembly, */ refName, start, end, bpPerPx }, abortSignal) {
    return ObservableCreate(async observer => {
      const ob2 = await this.bigwig.getFeatureStream(refName, start, end, {
        signal: abortSignal,
        basesPerSpan: bpPerPx,
      })
      ob2.subscribe(
        chunk => {
          chunk.forEach(record => {
            observer.next(
              new SimpleFeature({
                id: record.start + 1,
                data: record,
              }),
            )
          })
        },
        error => {
          throw new Error(error)
        },
        () => observer.complete(),
      )
    })
  }
}
