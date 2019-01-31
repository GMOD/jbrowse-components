import { Observable } from 'rxjs'

import { TwoBitFile } from '@gmod/twobit'

import { openLocation } from '../../util'
import BaseAdapter from '../../BaseAdapter'
import SimpleFeature from '../../util/simpleFeature'

export default class TwoBitAdapter extends BaseAdapter {
  constructor(config, rootConfig) {
    super(config, rootConfig)
    const { twoBitLocation } = config
    const twoBitOpts = {
      filehandle: openLocation(twoBitLocation),
    }

    this.twobit = new TwoBitFile(twoBitOpts)
  }

  async loadData() {
    const seqNames = await this.twobit.getSequenceNames()
    return seqNames
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  async getFeaturesInRegion({ refName, start, end }) {
    return Observable.create(async observer => {
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
