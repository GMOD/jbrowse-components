import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  FileLocation,
  NoAssemblyRegion,
  Region,
} from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { GenericFilehandle } from 'generic-filehandle'
import VcfParser from '@gmod/vcf'
import { Observer } from 'rxjs'
import { readConfObject } from '@jbrowse/core/configuration'
import VcfFeature from './VcfFeature'

export default class extends BaseFeatureDataAdapter {
  protected configured?: Promise<{
    vcf: TabixIndexedFile
    parser: typeof VcfParser
    filehandle: GenericFilehandle
  }>

  protected async configure() {
    if (!this.configured) {
      const vcfGzLocation = readConfObject(this.config, 'vcfGzLocation')
      const location = readConfObject(this.config, ['index', 'location'])
      const indexType = readConfObject(this.config, ['index', 'indexType'])

      const filehandle = openLocation(vcfGzLocation as FileLocation)
      const isCSI = indexType === 'CSI'
      const vcf = new TabixIndexedFile({
        filehandle,
        csiFilehandle: isCSI ? openLocation(location) : undefined,
        tbiFilehandle: !isCSI ? openLocation(location) : undefined,
        chunkCacheSize: 50 * 2 ** 20,
        chunkSizeLimit: 1000000000,
      })

      this.configured = vcf
        .getHeader()
        .then(header => ({
          filehandle,
          vcf,
          parser: new VcfParser({ header }),
        }))
        .catch(e => {
          this.configured = undefined
          throw e
        })
    }
    return this.configured
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { vcf } = await this.configure()
    return vcf.getReferenceSequenceNames(opts)
  }

  async getHeader() {
    const { vcf } = await this.configure()
    return vcf.getHeader()
  }

  async getMetadata() {
    const { parser } = await this.configure()
    return parser.getMetadata()
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query
      const { vcf, parser } = await this.configure()
      await vcf.getLines(refName, start, end, {
        lineCallback: (line: string, fileOffset: number) => {
          observer.next(
            new VcfFeature({
              variant: parser.parseLine(line),
              parser,
              id: `${this.id}-vcf-${fileOffset}`,
            }),
          )
        },
        ...opts,
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
   * @param regions - Regions
   * @param opts - Feature adapter options
   * @returns Observable of Feature objects in the regions
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    // TODO: restore commented version below once TSDX supports Rollup v2
    // xref: https://github.com/rollup/rollup/blob/master/CHANGELOG.md#bug-fixes-45
    const superGetFeaturesInMultipleRegions = super.getFeaturesInMultipleRegions
    return ObservableCreate<Feature>(async (observer: Observer<Feature>) => {
      const bytes = await this.bytesForRegions(regions)
      const { filehandle } = await this.configure()
      const stat = await filehandle.stat()
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
      superGetFeaturesInMultipleRegions
        .call(this, regions, opts)
        .subscribe(observer)
      // super.getFeaturesInMultipleRegions(regions, opts).subscribe(observer)
    })
  }

  /**
   * get the approximate number of bytes queried from the file for the given
   * query regions
   * @param regions - list of query regions
   */
  private async bytesForRegions(regions: Region[]) {
    const { vcf } = await this.configure()
    const blockResults = await Promise.all(
      regions.map(region =>
        // @ts-ignore
        vcf.index.blocksForRange(region.refName, region.start, region.end),
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
