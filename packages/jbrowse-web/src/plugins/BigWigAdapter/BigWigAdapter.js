import { BigWig } from '@gmod/bbi'
import BaseAdapter from '../../BaseAdapter'
import { openLocation } from '../../util/io'
import SimpleFeature from '../../util/simpleFeature'
import { ObservableCreate } from '../../util/rxjs'

function blankStats(covered) {
  return {
    scoreMax: -Infinity,
    scoreMin: Infinity,
    scoreSum: 0,
    scoreSumSquares: 0,
    basesCovered: covered,
    featureCount: 0,
  }
}

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

  async getGlobalStats() {
    const header = await this.bigwig.getHeader()
    return header.totalSummary
  }

  // todo: add caching
  // todo: incorporate summary blocks
  async getRegionStats({ refName, start, end }) {
    console.time('getf')
    const feats = await this.bigwig.getFeatures(refName, start, end)
    console.timeEnd('getf')
    console.log(refName, start, end)
    const blank = blankStats(end - start)
    if (!feats.length) {
      blank.scoreMax = 0
      blank.scoreMin = 0
    }
    const stats = feats.reduce((a, b) => {
      const s = b.score || 0
      return {
        ...a,
        scoreMax: Math.max(a.scoreMax, s),
        scoreMin: Math.min(a.scoreMin, s),
        scoreSum: a.scoreSum + s,
        scoreSumSquares: a.scoreSumSquares + s * s,
        featureCount: a.featureCount + 1,
      }
    }, blank)
    return rectifyStats(stats)
  }

  // todo: add caching
  async getMultiRegionStats(regions = []) {
    if (!regions.length) return undefined
    const ret = await Promise.all(regions.map(r => this.getRegionStats(r)))
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
    }, blankStats(0))
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
