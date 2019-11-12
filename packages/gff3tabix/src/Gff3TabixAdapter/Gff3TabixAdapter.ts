import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import {
  IFileLocation,
  INoAssemblyRegion,
  IRegion,
} from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import gff from '@gmod/gff'
import { GenericFilehandle } from 'generic-filehandle'
import { Observer } from 'rxjs'

export default class extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected gff: any

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    gffGzLocation: IFileLocation
    index: {
      index: string
      location: IFileLocation
    }
  }) {
    super()
    const {
      gffGzLocation,
      index: { location: indexLocation, index: indexType },
    } = config
    const gffGzOpts: {
      filehandle: GenericFilehandle
      tbiFilehandle?: GenericFilehandle
      csiFilehandle?: GenericFilehandle
      chunkCacheSize?: number
    } = {
      filehandle: openLocation(gffGzLocation),
      chunkCacheSize: 50 * 2 ** 20,
    }

    const indexFile = openLocation(indexLocation)
    if (indexType === 'CSI') {
      gffGzOpts.csiFilehandle = indexFile
    } else {
      gffGzOpts.tbiFilehandle = indexFile
    }
    this.gff = new TabixIndexedFile(gffGzOpts)
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.gff.getReferenceSequenceNames(opts)
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(query: INoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async (observer: Observer<Feature>) => {
      const lines = []
      await this.gff.getLines(query.refName, query.start, query.end, {
        lineCallback(line: string, fileOffset: number) {
          lines.push(line)
          const feat = gff.parseStringSync(line)

          const feature = new SimpleFeature({
            id: `gff-${fileOffset}`,
            data: feat,
          })
          observer.next(feature)
        },
        signal: opts.signal,
      })
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
