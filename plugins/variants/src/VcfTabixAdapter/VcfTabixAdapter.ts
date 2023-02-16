import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util'
import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'

// local
import VcfFeature from '../VcfFeature'

export default class extends BaseFeatureDataAdapter {
  private configured?: Promise<{
    vcf: TabixIndexedFile
    parser: VcfParser
  }>

  private async configurePre() {
    const pm = this.pluginManager
    const vcfGzLocation = this.getConf('vcfGzLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const filehandle = openLocation(vcfGzLocation, pm)
    const isCSI = indexType === 'CSI'
    const vcf = new TabixIndexedFile({
      filehandle,
      csiFilehandle: isCSI ? openLocation(location, pm) : undefined,
      tbiFilehandle: !isCSI ? openLocation(location, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
      chunkSizeLimit: 1000000000,
    })

    const header = await vcf.getHeader()
    return {
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

  public freeResources(/* { region } */): void {}
}
