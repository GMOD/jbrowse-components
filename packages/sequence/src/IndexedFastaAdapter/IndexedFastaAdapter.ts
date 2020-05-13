import { IndexedFasta } from '@gmod/indexedfasta'
import { BaseFeatureDataAdapter, RegionsAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { FileLocation, NoAssemblyRegion } from '@gmod/jbrowse-core/util/types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'

export default class extends BaseFeatureDataAdapter implements RegionsAdapter {
  protected fasta: typeof IndexedFasta

  public constructor(config: AnyConfigurationModel) {
    super(config)
    const fastaLocation = readConfObject(config, 'fastaLocation')
    const faiLocation = readConfObject(config, 'faiLocation')
    if (!fastaLocation) {
      throw new Error('must provide fastaLocation')
    }
    if (!faiLocation) {
      throw new Error('must provide faiLocation')
    }
    const fastaOpts = {
      fasta: openLocation(fastaLocation as FileLocation),
      fai: openLocation(faiLocation as FileLocation),
    }

    this.fasta = new IndexedFasta(fastaOpts)
  }

  public getRefNames() {
    return this.fasta.getSequenceList()
  }

  public async getRegions(): Promise<NoAssemblyRegion[]> {
    const seqSizes = await this.fasta.getSequenceSizes()
    return Object.keys(seqSizes).map(
      (refName: string): NoAssemblyRegion => ({
        refName,
        start: 0,
        end: seqSizes[refName],
      }),
    )
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures({ refName, start, end }: NoAssemblyRegion) {
    return ObservableCreate<Feature>(async observer => {
      const size = await this.fasta.getSequenceSize(refName)
      const regionEnd = size !== undefined ? Math.min(size, end) : end
      const seq: string = await this.fasta.getSequence(
        refName,
        start,
        regionEnd,
      )
      if (seq) {
        observer.next(
          new SimpleFeature({
            id: `${refName} ${start}-${regionEnd}`,
            data: { refName, start, end: regionEnd, seq },
          }),
        )
      }
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
