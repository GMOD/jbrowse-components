import { openLocation, FileLocation } from '@gmod/jbrowse-core/util/io'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Observer, Observable } from 'rxjs'
import { TabixIndexedFile } from '@gmod/tabix'
import VCF from '@gmod/vcf'
import VCFFeature from './VCFFeature'

export default class VcfTabixAdapter extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected vcf: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected parser: any

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    vcfGzLocation: FileLocation
    index: {
      indexType: string
      location: FileLocation
    }
  }) {
    super()
    const { vcfGzLocation, index } = config
    if (!vcfGzLocation) {
      throw new Error('must provide vcfGzLocation')
    }
    if (!index || !index.location) {
      throw new Error('must provide index.location')
    }
    const loc = openLocation(index.location)
    this.vcf = new TabixIndexedFile({
      filehandle: openLocation(vcfGzLocation),
      tbiFilehandle: index.indexType == 'TBI' ? loc : undefined,
      csiFilehandle: index.indexType == 'CSI' ? loc : undefined,
    })

    this.parser = this.vcf
      .getHeader()
      .then((header: string) => new VCF({ header }))
  }

  public async getRefNames(): Promise<string[]> {
    return this.vcf.getSequenceList()
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(query: IRegion): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        const p = await this.parser
        await this.vcf.getLines(
          query.refName,
          query.start,
          query.end,
          (line: string, fileOffset: number) => {
            const variant = p.parseLine(line)

            const feature = new VCFFeature({
              variant,
              p,
              id: variant.ID
                ? variant.ID[0]
                : `chr${variant.CHROM}_pos${variant.POS}_ref${variant.REF}_alt${
                    variant.ALT
                  }`,
            })
            observer.next(feature)
          },
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
