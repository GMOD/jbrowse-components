import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import VcfFeature from '../VcfFeature/index.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class SplitVcfTabixAdapter extends BaseFeatureDataAdapter {
  private async configurePre(refName: string) {
    const indexType = this.getConf('indexType')
    const vcfGzLocation = this.getConf('vcfGzLocationMap')[refName]
    const indexLocation = this.getConf('indexLocationMap')[refName] || {
      uri: `${vcfGzLocation.uri}.${indexType.toLowerCase()}`,
    }

    const filehandle = openLocation(vcfGzLocation, this.pluginManager)
    const isCSI = indexType === 'CSI'
    const vcf = new TabixIndexedFile({
      filehandle,
      csiFilehandle: isCSI
        ? openLocation(indexLocation, this.pluginManager)
        : undefined,
      tbiFilehandle: !isCSI
        ? openLocation(indexLocation, this.pluginManager)
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

  async configure(refName: string, opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.configurePre(refName),
    )
  }

  public async getRefNames() {
    return Object.keys(this.getConf('vcfGzLocationMap'))
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query
      const { statusCallback = () => {} } = opts
      const { vcf, parser } = await this.configure(query.refName, opts)

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
    const r = Object.keys(this.getConf('vcfGzLocationMap'))[0]!
    if (conf.uri === '' || conf.uri === '/path/to/samples.tsv') {
      const { parser } = await this.configure(r)
      return parser.samples.map(name => ({
        name,
      }))
    } else {
      const txt = await fetchAndMaybeUnzipText(
        openLocation(conf, this.pluginManager),
      )
      const lines = txt.split(/\n|\r\n|\r/)
      const header = lines[0]!.split('\t')
      const { parser } = await this.configure(r)
      const s = new Set(parser.samples)
      return lines
        .slice(1)
        .map(line => {
          const cols = line.split('\t')
          return {
            name: cols[0]!,
            ...Object.fromEntries(
              // force col 0 to be called name
              cols.slice(1).map((c, idx) => [header[idx + 1]!, c] as const),
            ),
          }
        })
        .filter(f => s.has(f.name))
    }
  }
}
