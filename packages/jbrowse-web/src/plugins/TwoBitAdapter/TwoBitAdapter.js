import { Observable } from 'rxjs'

import { TwoBitFile } from '@gmod/twobit'

import { openLocation } from '../../util/io'
import BaseAdapter from '../../BaseAdapter'
import SimpleFeature from '../../util/simpleFeature'

export default class TwoBitAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    const { twoBitLocation } = config
    const twoBitOpts = {
      filehandle: openLocation(twoBitLocation),
    }

    this.twobit = new TwoBitFile(twoBitOpts)
  }

  async loadData() {
    return this.twobit.getSequenceNames()
  }

  async getRegions() {
    const seqNames = await this.twobit.getSequenceNames()
    const regions = []
    for (const seqName of seqNames) {
      regions.push({
        assemblyName: '',
        refName: seqName,
        start: 0,
        // don't use `await Promise.all() because what if there are many seqNames?
        // eslint-disable-next-line no-await-in-loop
        end: await this.twobit.getSequenceSize(seqName),
      })
    }
    return regions
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  async getFeatures({ refName, start, end }) {
    await this.loadData()
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
