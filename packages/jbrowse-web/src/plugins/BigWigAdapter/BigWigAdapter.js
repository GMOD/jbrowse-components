import { Observable } from 'rxjs'

import { BigWig } from '@gmod/bbi'

import { openLocation } from '../../util'
import SimpleFeature from '../../util/simpleFeature'

export default class BigWigAdapter {
  constructor(config) {
    const { bigWigLocation, assemblyName } = config
    const bigWigOpts = {
      filehandle: openLocation(bigWigLocation),
    }

    this.assemblyName = assemblyName

    this.bigwig = new BigWig(bigWigOpts)
    this.gotBigWigHeader = this.bigwig.getHeader()
  }

  async hasDataForRefSeq({ assembly }) {
    if (this.assemblyName !== assembly) return false
    const header = await this.gotBigWigHeader
    console.log(header)
    return true // TODO
  }

  async refIdToName(refId) {
    const header = await this.gotBigWigHeader
    console.log(header)
    return (header.refsByName[refId] || {}).name
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeaturesInRegion({ /* assembly, */ refName, start, end }) {
    // TODO
    return Observable.create(async observer => {
      const records = await this.bigwig.getFeatures(refName, start, end)
      records.forEach(record => {
        observer.next(
          new SimpleFeature({
            id: record.start,
            data: record,
          }),
        )
      })
      observer.complete()
    })
  }
}
