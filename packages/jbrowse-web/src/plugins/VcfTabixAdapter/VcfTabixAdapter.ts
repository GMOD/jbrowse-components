import { openLocation, FileLocation } from '@gmod/jbrowse-core/util/io'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Observer, Observable } from 'rxjs'
import { TabixIndexedFile } from '@gmod/tabix'

export default class VcfTabixAdapter extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected vcf: any

  public static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  public constructor(config: {
    vcfGzLocation: FileLocation
    tbiLocation: FileLocation
    csiLocation: FileLocation
  }) {
    super()
    const { vcfGzLocation, tbiLocation, csiLocation } = config
    if (!vcfGzLocation) {
      throw new Error('must provide vcfGzLocation')
    }
    if (!tbiLocation && !csiLocation) {
      throw new Error('must provide tbiLocation or csiLocation')
    }
    const vcfGzOpts = {
      filehandle: openLocation(vcfGzLocation),
      tbiFilehandle: openLocation(tbiLocation),
      csiFilehandle: openLocation(csiLocation),
    }

    this.vcf = new TabixIndexedFile(vcfGzOpts)
  }

  public async getRefNames(): Promise<string[]> {
    return this.vcf.getSequenceList()
  }

  public async getRegions(): Promise<IRegion[]> {
    const seqSizes = await this.vcf.getSequenceSizes()
    return Object.keys(seqSizes).map(
      (refName: string): IRegion => ({
        refName,
        start: 0,
        end: seqSizes[refName],
      }),
    )
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures({ refName, start, end }: IRegion): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        const seq = await this.vcf.getSequence(refName, start, end)
        if (seq)
          observer.next(
            new SimpleFeature({
              id: `${refName} ${start}-${end}`,
              data: { refName, start, end, seq },
            }),
          )
        observer.complete()
      },
    )
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
