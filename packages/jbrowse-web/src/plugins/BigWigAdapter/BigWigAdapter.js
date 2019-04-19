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
  async getRegionStats({ refName, start, end }, opts) {
    const feats = await this.bigwig.getFeatures(refName, start, end, opts)
    const scores = feats.map(s => s.score)

    const scoreMax = Math.max(...scores)
    const scoreMin = Math.min(...scores)
    const scoreSum = scores.reduce((a, b) => a + b, 0)
    const scoreSumSquares = scores.reduce((a, b) => a + b * b, 0)
    const featureCount = scores.length
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

  getFeatures({ /* assembly, */ refName, start, end }, opts = {}) {
    return ObservableCreate(async observer => {
      const ob2 = await this.bigwig.getFeatureStream(refName, start, end, opts)
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
