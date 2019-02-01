import { Observable } from 'rxjs'

import { IndexedFasta } from '@gmod/indexedfasta'

import { openLocation } from '../../util'
import SimpleFeature from '../../util/simpleFeature'
import BaseAdapter from '../../BaseAdapter'

export default class IndexedFastaAdapter extends BaseAdapter {
  constructor(config, rootConfig) {
    super(config, rootConfig)
    const { fastaLocation, faiLocation } = config
    if (!fastaLocation) {
      throw new Error('must provide fastaLocation')
    }
    if (!faiLocation) {
      throw new Error('must provide faiLocation')
    }
    const fastaOpts = {
      fasta: openLocation(fastaLocation),
      fai: openLocation(faiLocation),
    }

    this.fasta = new IndexedFasta(fastaOpts)
  }

  loadData() {
    return this.fasta.getSequenceList()
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeaturesInRegion({ /* assembly, */ refName, start, end }) {
    // TODO
    return Observable.create(async observer => {
      const seq = await this.fasta.getSequence(refName, start, end)
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
