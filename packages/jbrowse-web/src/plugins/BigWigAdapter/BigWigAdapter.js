import { BigWig } from '@gmod/bbi'
import BaseAdapter from '../../BaseAdapter'
import { openLocation } from '../../util/io'
import SimpleFeature from '../../util/simpleFeature'
import { ObservableCreate } from '../../util/rxjs'

function calcStdFromSums(sum, sumSquares, n) {
  if (n === 0) return 0

  let variance = sumSquares - (sum * sum) / n
  if (n > 1) {
    variance /= n - 1
  }
  return variance < 0 ? 0 : Math.sqrt(variance)
}

function rectifyStats(s) {
  return {
    ...s,
    scoreMean: s.featureCount ? s.scoreSum / s.featureCount : 0,
    scoreStdDev: calcStdFromSums(s.scoreSum, s.scoreSumSquares, s.featureCount),
    featureDensity: s.featureCount / s.basesCovered,
  }
}

export default class BigWigAdapter extends BaseAdapter {
  static capabilities = ['getFeatures', 'getRefNames']

  constructor(config) {
    super(config)
    this.bigwig = new BigWig({
      filehandle: openLocation(config.bigWigLocation),
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

  // todo: add caching
  // todo: incorporate summary blocks
  async getRegionStats({ refName, start, end }, abortSignal) {
    const feats = await this.bigwig.getFeatures(refName, start, end, {
      signal: abortSignal,
    })

    const scoreMax = feats.reduce(
      (acc, curr) => Math.max(acc, curr.score),
      -Infinity,
    )
    const scoreMin = feats.reduce(
      (acc, curr) => Math.min(acc, curr.score),
      Infinity,
    )
    const scoreSum = feats.reduce((acc, curr) => curr.score + acc, 0)
    const scoreSumSquares = feats.reduce((acc, curr) => {
      const s = curr.score
      return s * s + acc
    }, 0)
    const featureCount = feats.length
    const basesCovered = end - start

    return rectifyStats({
      scoreMax,
      scoreMin,
      scoreSum,
      scoreSumSquares,
      featureCount,
      basesCovered,
    })
  }

  // todo: add caching
  async getMultiRegionStats(regions = [], abortSignal) {
    if (!regions.length) return undefined
    const ret = await Promise.all(
      regions.map(r => this.getRegionStats(r, abortSignal)),
    )
    const s = ret.reduce((a, b) => {
      return {
        ...a,
        scoreMax: Math.max(a.scoreMax, b.scoreMax),
        scoreMin: Math.min(a.scoreMin, b.scoreMin),
        scoreSum: a.scoreSum + b.scoreSum,
        scoreSumSquares: a.scoreSumSquares + b.scoreSumSquares,
        featureCount: a.featureCount + b.featureCount,
        basesCovered: a.basesCovered + b.basesCovered,
      }
    })
    return rectifyStats(s)
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */

  getFeatures({ /* assembly, */ refName, start, end }, signal) {
    return ObservableCreate(async observer => {
      const ob2 = await this.bigwig.getFeatureStream(refName, start, end, {
        signal,
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
