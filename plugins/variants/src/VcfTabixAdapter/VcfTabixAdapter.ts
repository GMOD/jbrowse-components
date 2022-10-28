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
import { bytesForRegions } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { Observer } from 'rxjs'
import { readConfObject } from '@jbrowse/core/configuration'
import VcfFeature from './VcfFeature'
import { GenericFilehandle } from 'generic-filehandle'

export default class extends BaseFeatureDataAdapter {
  private configured?: Promise<{
    filehandle: GenericFilehandle
    vcf: TabixIndexedFile
    parser: VcfParser
  }>

  private async configurePre() {
    const vcfGzLocation = readConfObject(this.config, 'vcfGzLocation')
    const location = readConfObject(this.config, ['index', 'location'])
    const indexType = readConfObject(this.config, ['index', 'indexType'])

    const filehandle = openLocation(
      vcfGzLocation as FileLocation,
      this.pluginManager,
    )
    const isCSI = indexType === 'CSI'
    const vcf = new TabixIndexedFile({
      filehandle,
      csiFilehandle: isCSI
        ? openLocation(location, this.pluginManager)
        : undefined,
      tbiFilehandle: !isCSI
        ? openLocation(location, this.pluginManager)
        : undefined,
      chunkCacheSize: 50 * 2 ** 20,
      chunkSizeLimit: 1000000000,
    })

    const header = await vcf.getHeader()
    return {
      filehandle,
      vcf,
      parser: new VcfParser({ header }),
    }
  }

  protected async configure() {
    if (!this.configured) {
      this.configured = this.configurePre().catch(e => {
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
        lineCallback: (line, fileOffset) => {
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
    return ObservableCreate<Feature>(async (observer: Observer<Feature>) => {
      const { vcf } = await this.configure()

      // @ts-ignore
      const bytes = await bytesForRegions(regions, vcf.index)
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
      super.getFeaturesInMultipleRegions(regions, opts).subscribe(observer)
    })
  }

  public freeResources(/* { region } */): void {}
}
