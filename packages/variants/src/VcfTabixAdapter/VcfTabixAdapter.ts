import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import {
  IFileLocation,
  INoAssemblyRegion,
  IRegion,
} from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { GenericFilehandle } from 'generic-filehandle'
import VcfParser from '@gmod/vcf'
import { Observer } from 'rxjs'
import VcfFeature from './VcfFeature'

interface Config {
  vcfGzLocation: IFileLocation
  index: {
    indexType: string
    location: IFileLocation
  }
}
export default class extends BaseAdapter {
  protected vcf: TabixIndexedFile

  protected filehandle: GenericFilehandle

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected parser: any

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: Config) {
    super()
    const { vcfGzLocation, index } = config
    const { location, indexType } = index

    this.filehandle = openLocation(vcfGzLocation)
    this.vcf = new TabixIndexedFile({
      filehandle: this.filehandle,
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      tbiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })

    this.parser = this.vcf
      .getHeader()
      .then((header: string) => new VcfParser({ header }))
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.vcf.getReferenceSequenceNames(opts)
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(query: INoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const parser = await this.parser
      await this.vcf.getLines(query.refName, query.start, query.end, {
        lineCallback(line: string, fileOffset: number) {
          const variant = parser.parseLine(line)

          const feature = new VcfFeature({
            variant,
            parser,
            id: `vcf-${fileOffset}`,
          }) as Feature
          observer.next(feature)
        },
        signal: opts.signal,
      })
      observer.complete()
    })
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters
   * that are frequently called on multiple regions simultaneously may
   * want to implement a more efficient custom version of this method.
   *
   * @param {[Region]} regions see getFeatures()
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} see getFeatures()
   */
  public getFeaturesInMultipleRegions(
    regions: IRegion[],
    opts: BaseOptions = {},
  ) {
    return ObservableCreate<Feature>(async (observer: Observer<Feature>) => {
      const bytes = await this.bytesForRegions(regions)
      const stat = await this.filehandle.stat()
      let pct = Math.round((bytes / stat.size) * 100)
      if (pct > 100) {
        // this is just a bad estimate, make 100% if it goes over
        pct = 100
      }
      if (pct > 60) {
        console.warn(
          `getFeaturesInMultipleRegions fetching ${pct}% of VCF file, but whole-file streaming not yet implemented`,
        )
      }
      super.getFeaturesInMultipleRegions(regions, opts).subscribe(observer)
    })
  }

  /**
   * get the approximate number of bytes queried from the file for the given
   * query regions
   * @param regions list of query regions
   */
  private async bytesForRegions(regions: IRegion[]) {
    const blockResults = await Promise.all(
      regions.map(region =>
        // @ts-ignore
        this.vcf.index.blocksForRange(region.refName, region.start, region.end),
      ),
    )
    interface ByteRange {
      start: number
      end: number
    }
    interface VirtualOffset {
      blockPosition: number
    }
    interface Block {
      minv: VirtualOffset
      maxv: VirtualOffset
    }
    const byteRanges: ByteRange[] = []
    blockResults.forEach((blocks: Block[]) => {
      blocks.forEach(block => {
        const start = block.minv.blockPosition
        const end = block.maxv.blockPosition + 64000
        if (
          !byteRanges.find(range => {
            if (range.start <= end && range.end >= start) {
              range.start = Math.min(range.start, start)
              range.end = Math.max(range.end, end)
              return true
            }
            return false
          })
        ) {
          byteRanges.push({ start, end })
        }
      })
    })

    return byteRanges.reduce((a, b) => a + b.end - b.start + 1, 0)
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
