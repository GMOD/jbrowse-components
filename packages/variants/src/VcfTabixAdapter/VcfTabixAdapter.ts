import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import {
  FileLocation,
  NoAssemblyRegion,
  Region,
} from '@gmod/jbrowse-core/util/types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { GenericFilehandle } from 'generic-filehandle'
import VcfParser from '@gmod/vcf'
import { Observer } from 'rxjs'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import VcfFeature from './VcfFeature'
import MyConfigSchema from './configSchema'

export default class extends BaseFeatureDataAdapter {
  protected vcf: TabixIndexedFile

  protected filehandle: GenericFilehandle

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected parser: any

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const vcfGzLocation = readConfObject(config, 'vcfGzLocation')
    const location = readConfObject(config, ['index', 'location'])
    const indexType = readConfObject(config, ['index', 'indexType'])

    this.filehandle = openLocation(vcfGzLocation as FileLocation)
    this.vcf = new TabixIndexedFile({
      filehandle: this.filehandle,
      csiFilehandle:
        indexType === 'CSI'
          ? openLocation(location as FileLocation)
          : undefined,
      tbiFilehandle:
        indexType !== 'CSI'
          ? openLocation(location as FileLocation)
          : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })

    this.parser = this.vcf
      .getHeader()
      .then((header: string) => new VcfParser({ header }))
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.vcf.getReferenceSequenceNames(opts)
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const parser = await this.parser
      await this.vcf.getLines(query.refName, query.start, query.end, {
        lineCallback: (line: string, fileOffset: number) => {
          const variant = parser.parseLine(line)

          const feature = new VcfFeature({
            variant,
            parser,
            id: `${this.id}-vcf-${fileOffset}`,
          }) as Feature
          observer.next(feature)
        },
        signal: opts.signal,
      })
      observer.complete()
    }, opts.signal)
  }

  /**
   * Checks if the data source has data for the given reference sequence,
   * and then gets the features in the region if it does
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters that
   * are frequently called on multiple regions simultaneously may want to
   * implement a more efficient custom version of this method.
   *
   * Also includes a bit of extra logging to warn when fetching a large portion
   * of a VCF
   * @param regions Regions
   * @param opts Feature adapter options
   * @returns Observable of Feature objects in the regions
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
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
  private async bytesForRegions(regions: Region[]) {
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

  public freeResources(/* { region } */): void {}
}
