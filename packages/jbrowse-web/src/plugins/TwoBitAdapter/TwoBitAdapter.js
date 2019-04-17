import { TwoBitFile } from '@gmod/twobit'

import { openLocation } from '@gmod/jbrowse-core/util/io'
import BaseAdapter from '../../BaseAdapter'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'

export default class TwoBitAdapter extends BaseAdapter {
  static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  constructor(config) {
    super()
    const { twoBitLocation } = config
    const twoBitOpts = {
      filehandle: openLocation(twoBitLocation),
    }

    this.twobit = new TwoBitFile(twoBitOpts)
  }

  async getRefNames() {
    return this.twobit.getSequenceNames()
  }

  async getRegions() {
    const refSizes = await this.twobit.getSequenceSizes()
    const regions = []
    Object.keys(refSizes).forEach(refName => {
      regions.push({
        refName,
        start: 0,
        end: refSizes[refName],
      })
    })
    return regions
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures({ refName, start, end }) {
    return ObservableCreate(async observer => {
      const seq = await this.twobit.getSequence(refName, start, end)
      observer.next(
        new SimpleFeature({
          id: `${refName} ${start}-${end}`,
          data: { refName, start, end, seq },
        }),
      )
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
