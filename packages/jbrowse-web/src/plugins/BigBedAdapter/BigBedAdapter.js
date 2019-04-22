import { mergeAll, map } from 'rxjs/operators'
import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'

import { ObservableCreate } from '../../util/rxjs'
import BaseAdapter from '../../BaseAdapter'
import { openLocation } from '../../util/io'
import SimpleFeature from '../../util/simpleFeature'

export default class BigBedAdapter extends BaseAdapter {
  static capabilities = ['getFeatures', 'getRefNames']

  constructor(config) {
    super(config)
    this.bigbed = new BigBed({
      filehandle: openLocation(config.bigBedLocation),
    })

    this.parser = this.bigbed
      .getHeader()
      .then(({ autoSql }) => new BED({ autoSql }))
  }

  async getRefNames() {
    const header = await this.bigbed.getHeader()
    return Object.keys(header.refsByName)
  }

  async refIdToName(refId) {
    return ((await this.bigbed.getHeader()).refsByNumber[refId] || {}).name
  }

  async getGlobalStats() {
    const header = await this.bigbed.getHeader()
    return header.totalSummary
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures({ /* assembly, */ refName, start, end }, abortSignal) {
    return ObservableCreate(async observer => {
      const parser = await this.parser
      const observable2 = await this.bigbed.getFeatureStream(
        refName,
        start,
        end,
        {
          signal: abortSignal,
        },
      )
      return observable2
        .pipe(
          mergeAll(),
          map(r => {
            const data = regularizeFeat(
              parser.parseLine(`${refName}\t${r.start}\t${r.end}\t${r.rest}`, {
                uniqueId: r.uniqueId,
              }),
            )
            return new SimpleFeature({ data })
          }),
        )
        .subscribe(observer)
    })
  }
}

/*
 * regularizes a feature by modifying the {chrom,chromStart,chromEnd} to {refName,start,end}
 * @params featureData a feature to regularize
 * @return a regularized feature
 */
export function regularizeFeat(featureData) {
  const {
    chrom: refName,
    chromStart: start,
    chromEnd: end,
    ...rest
  } = featureData
  return { ...rest, refName, start, end }
}
