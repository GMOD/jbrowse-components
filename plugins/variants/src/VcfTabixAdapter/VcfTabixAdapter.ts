import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import VcfFeature from '../VcfFeature'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class VcfTabixAdapter extends BaseFeatureDataAdapter {
  private configured?: Promise<{
    vcf: TabixIndexedFile
    parser: VcfParser
  }>

  private async configurePre(_opts?: BaseOptions) {
    const vcfGzLocation = this.getConf('vcfGzLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const filehandle = openLocation(vcfGzLocation, this.pluginManager)
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
    })

    return {
      vcf,
      parser: new VcfParser({
        header: await vcf.getHeader(),
      }),
    }
  }

  protected async configurePre2() {
    if (!this.configured) {
      this.configured = this.configurePre().catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    }
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.configurePre2(),
    )
  }
  public async getRefNames(opts: BaseOptions = {}) {
    const { vcf } = await this.configure(opts)
    return vcf.getReferenceSequenceNames(opts)
  }

  async getHeader(opts?: BaseOptions) {
    const { vcf } = await this.configure(opts)
    return vcf.getHeader()
  }

  async getMetadata(opts?: BaseOptions) {
    const { parser } = await this.configure(opts)
    return parser.getMetadata()
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query
      const { statusCallback = () => {} } = opts
      const { vcf, parser } = await this.configure(opts)

      await updateStatus('Downloading variants', statusCallback, () =>
        vcf.getLines(refName, start, end, {
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
        }),
      )
      observer.complete()
    }, opts.stopToken)
  }

  async getSources() {
    const conf = this.getConf('samplesTsvLocation')
    if (conf.uri === '' || conf.uri === '/path/to/samples.tsv') {
      const { parser } = await this.configure()
      return parser.samples.map(name => ({
        name,
      }))
    } else {
      const txt = await fetchAndMaybeUnzipText(
        openLocation(conf, this.pluginManager),
      )
      const lines = txt.split(/\n|\r\n|\r/)
      const header = lines[0]!.split('\t')
      const { parser } = await this.configure()
      const s = new Set(parser.samples)
      const ret = lines
        .slice(1)
        .filter(f => !!f)
        .map(line => {
          const [name, ...rest] = line.split('\t')
          return {
            ...Object.fromEntries(
              // force col 0 to be called name
              rest.map((c, idx) => [header[idx + 1]!, c] as const),
            ),
            name: name!,
          }
        })
      const missing = ret.filter(f => !s.has(f.name))
      if (missing.length) {
        console.warn(
          'Samples in metadata file not in VCF:',
          ret.filter(f => !s.has(f.name)),
        )
      }
      return ret.filter(f => s.has(f.name))
    }
  }

  public freeResources(/* { region } */): void {}
}
