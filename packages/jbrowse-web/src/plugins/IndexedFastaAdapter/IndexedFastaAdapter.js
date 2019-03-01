import { IndexedFasta } from '@gmod/indexedfasta'

import { openLocation } from '../../util/io'
import SimpleFeature from '../../util/simpleFeature'
import BaseAdapter from '../../BaseAdapter'
import { ObservableCreate } from '../../util/rxjs'

export default class IndexedFastaAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
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

  async loadData() {
    return this.fasta.getSequenceList()
  }

  async getRegions(assemblyName = '') {
    const seqSizes = await this.fasta.getSequenceSizes()
    const regions = []
    Object.keys(seqSizes).forEach(seqName => {
      regions.push({
        assemblyName,
        refName: seqName,
        start: 0,
        end: seqSizes[seqName],
      })
    })
    return regions
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures({ /* assembly, */ refName, start, end }) {
    return ObservableCreate(async observer => {
      await this.loadData()
      const seq = await this.fasta.getSequence(refName, start, end)
      if (seq)
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
