import { openLocation } from '@gmod/jbrowse-core/util/io'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { GenericFilehandle } from 'generic-filehandle'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Observer, Observable } from 'rxjs'
import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import VcfFeature from './VcfFeature'

export default class VcfTabixAdapter extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected vcf: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected parser: any

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    vcfGzLocation: IFileLocation
    index: {
      index: string
      location: IFileLocation
    }
  }) {
    super()
    const {
      vcfGzLocation,
      index: { location: indexLocation, index: indexType },
    } = config
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
      .then((header: string) => new VcfParser({ header }))
  }

  public async getRefNames(): Promise<string[]> {
    const ret = await this.vcf.getReferenceSequenceNames()
    return ret
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(
    query: INoAssemblyRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        const parser = await this.parser
        await this.vcf.getLines(
          query.refName,
          query.start,
          query.end,
          (line: string, fileOffset: number) => {
            const variant = parser.parseLine(line)

            const feature = new VcfFeature({
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
