import { Observable } from 'rxjs'

import { IndexedFasta, BgzipIndexedFasta } from '@gmod/indexedfasta'

import { openLocation } from '../../util'
import SimpleFeature from '../../util/simpleFeature'

export default class IndexedFastaAdapter {
  constructor(config) {
    const { fastaLocation, faiLocation, gziLocation, assemblyName } = config
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

    this.assemblyName = assemblyName
    if (gziLocation) {
      fastaOpts.gzi = openLocation(gziLocation)
      this.fasta = new BgzipIndexedFasta(fastaOpts)
    } else {
      this.fasta = new IndexedFasta(fastaOpts)
    }
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
