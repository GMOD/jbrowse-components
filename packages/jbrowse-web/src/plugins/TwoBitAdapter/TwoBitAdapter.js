import { Observable } from 'rxjs'

import { TwoBitFile } from '@gmod/twobit'

import { openLocation } from '../../util'

export default class TwoBitAdapter {
  constructor(config) {
    const { twoBitLocation, assemblyName } = config
    const twoBitOpts = {
      filehandle: openLocation(twoBitLocation),
    }

    this.assemblyName = assemblyName
    this.twobit = new TwoBitFile(twoBitOpts)
    this.gotTwoBitHeader = this.twobit.getHeader()
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeaturesInRegion({ /* assembly, */ refName, start, end }) {
    // TODO
    return Observable.create(async observer => {
      await this.gotTwoBitHeader
      const seq = await this.twobit.getSequence(refName, start, end)
      observer.next(seq)
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */) {}
}
