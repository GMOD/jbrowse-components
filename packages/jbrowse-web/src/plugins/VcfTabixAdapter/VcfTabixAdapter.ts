import { openLocation, FileLocation } from '@gmod/jbrowse-core/util/io'
import { GenericFilehandle } from 'generic-filehandle'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
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
      index: string
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

    const { location: indexLocation, index: indexType } = config.index
    const vcfGzOpts: {
      filehandle: GenericFilehandle
      tbiFilehandle?: GenericFilehandle
      csiFilehandle?: GenericFilehandle
    } = {
      filehandle: openLocation(vcfGzLocation),
    }

    const indexFile = openLocation(indexLocation)
    if (indexType === 'CSI') {
      vcfGzOpts.csiFilehandle = indexFile
    } else {
      vcfGzOpts.tbiFilehandle = indexFile
    }
    this.vcf = new TabixIndexedFile(vcfGzOpts)
    this.parser = this.vcf
      .getHeader()
      .then((header: string) => new VCF({ header }))
  }

  public getRefNames(): Promise<string[]> {
    return this.vcf.getReferenceSequenceNames()
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(query: IRegion): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        const parser = await this.parser
        await this.vcf.getLines(
          query.refName,
          query.start,
          query.end,
          (line: string, fileOffset: number) => {
            const variant = parser.parseLine(line)

            const feature = new VCFFeature({
              variant,
              parser,
              id: `vcf-${fileOffset}`,
            }) as Feature
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
