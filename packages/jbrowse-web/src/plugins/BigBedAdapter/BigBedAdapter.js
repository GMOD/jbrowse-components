import { Observable } from 'rxjs'

import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'

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
  getFeatures({ /* assembly, */ refName, start, end }) {
    return Observable.create(async observer => {
      const parser = await this.parser
      const records = await this.bigbed.getFeatures(refName, start, end)
      records.forEach(r => {
        const data = parser.parseBedText(refName, r.start, r.end, r.rest, {
          offset: 3,
          uniqueId: r.uniqueId,
        })
        observer.next(new SimpleFeature({ data }))
      })
      observer.complete()
    })
  }
}
