import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import VcfFeature from '../VcfFeature/index.ts'
import { parseSamplesTsv } from '../shared/parseSamplesTsv.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class SplitVcfTabixAdapter extends BaseFeatureDataAdapter {
  private configuredByRef = new Map<
    string,
    Promise<{ vcf: TabixIndexedFile; parser: VcfParser }>
  >()

  private configureOnce(refName: string) {
    if (!this.configuredByRef.has(refName)) {
      const indexType = this.getConf('indexType')
      const vcfGzLocation = this.getConf('vcfGzLocationMap')[refName]
      const indexLocation = this.getConf('indexLocationMap')[refName] ?? {
        uri: `${vcfGzLocation.uri}.${indexType.toLowerCase()}`,
      }
      const vcf = new TabixIndexedFile({
        filehandle: openLocation(vcfGzLocation, this.pluginManager),
        ...openTabixIndexFilehandle(
          indexLocation,
          indexType,
          this.pluginManager,
        ),
        chunkCacheSize: 50 * 2 ** 20,
      })
      this.configuredByRef.set(
        refName,
        vcf
          .getHeader()
          .then(header => ({
            vcf,
            parser: new VcfParser({ header }),
          }))
          .catch((e: unknown) => {
            this.configuredByRef.delete(refName)
            throw e
          }),
      )
    }
    return this.configuredByRef.get(refName)!
  }

  async configure(refName: string, opts?: BaseOptions) {
    return updateStatus('Downloading index', opts?.statusCallback, () =>
      this.configureOnce(refName),
    )
  }

  public async getRefNames() {
    return Object.keys(this.getConf('vcfGzLocationMap'))
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query
      const { vcf, parser } = await this.configure(refName, opts)

      await updateStatus('Downloading variants', opts.statusCallback, () =>
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
    const { parser } = await this.configure(r)
    if (conf.uri === '' || conf.uri === '/path/to/samples.tsv') {
      return parser.samples.map(name => ({ name }))
    } else {
      const txt = await fetchAndMaybeUnzipText(
        openLocation(conf, this.pluginManager),
      )
      return parseSamplesTsv(txt, parser.samples)
    }
  }
}
