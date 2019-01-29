import { Observable } from 'rxjs'

import { IndexedFasta } from '@gmod/indexedfasta'

import { openLocation } from '../../util'
import SimpleFeature from '../../util/simpleFeature'

export default class IndexedFastaAdapter {
  constructor(config) {
    const { fastaLocation, assemblyName } = config
    const indexLocation = config.index.location
    const fastaOpts = {
      fasta: openLocation(fastaLocation),
    }

    this.assemblyName = assemblyName

    const indexFile = openLocation(indexLocation)
    fastaOpts.fai = indexFile

    this.fasta = new IndexedFasta(fastaOpts)
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
