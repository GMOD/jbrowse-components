import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  downloadStatusReporter,
  fetchAndMaybeUnzipText,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import VcfFeature from '../VcfFeature/index.ts'
import { parseSamplesTsv } from '../shared/parseSamplesTsv.ts'

import type { VcfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class VcfTabixAdapter extends BaseFeatureDataAdapter<VcfTabixAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

  private configured?: Promise<{
    vcf: TabixIndexedFile
    parser: VcfParser
    header: string
  }>

  private configureOnce() {
    if (!this.configured) {
      const vcfGzLocation = this.getConf('vcfGzLocation')
      const location = this.getConf(['index', 'location'])
      const indexType = this.getConf(['index', 'indexType'])
      const vcf = new TabixIndexedFile({
        filehandle: openLocation(vcfGzLocation, this.pluginManager),
        ...openTabixIndexFilehandle(location, indexType, this.pluginManager),
        chunkCacheSize: 50 * 2 ** 20,
      })
      this.configured = vcf
        .getHeader()
        .then(header => ({
          vcf,
          parser: new VcfParser({ header }),
          header,
        }))
        .catch((e: unknown) => {
          this.configured = undefined
          throw e
        })
    }
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    return updateStatus('Downloading index', opts?.statusCallback, () =>
      this.configureOnce(),
    )
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const { vcf } = await this.configure(opts)
    const bytes = await vcf.bytesForRegions(regions, opts)
    return { bytes, fetchSizeLimit: 1_000_000 }
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { vcf } = await this.configure(opts)
    return vcf.getReferenceSequenceNames(opts)
  }

  async getHeader(opts?: BaseOptions) {
    const { header } = await this.configure(opts)
    return header
  }

  async getMetadata(opts?: BaseOptions) {
    const { parser } = await this.configure(opts)
    return parser.getMetadata()
  }

  public async getExportData(
    regions: NoAssemblyRegion[],
    formatType: string,
    opts?: BaseOptions,
  ): Promise<string | undefined> {
    if (formatType !== 'vcf') {
      return undefined
    }

    const { vcf, header } = await this.configure(opts)
    const exportLines: string[] = header.split('\n').filter(Boolean)

    for (const region of regions) {
      await updateStatus('Exporting variants', opts?.statusCallback, () =>
        vcf.getLines(region.refName, region.start, region.end, {
          lineCallback: (line: string) => {
            exportLines.push(line)
          },
          ...opts,
        }),
      )
    }

    return exportLines.join('\n')
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query
      const { vcf, parser } = await this.configure(opts)
      const { statusCallback } = opts

      // updateStatus shows the label and clears when done; onProgress upgrades
      // the in-between status to a determinate bar as the blocks download
      await updateStatus('Downloading variants', statusCallback, () =>
        vcf.getLines(refName, start, end, {
          signal: opts.signal,
          lineCallback: (line, fileOffset) => {
            observer.next(
              new VcfFeature({
                variant: parser.parseLine(line),
                parser,
                id: `${this.id}-vcf-${fileOffset}`,
              }),
            )
          },
          onProgress: downloadStatusReporter(
            statusCallback,
            'Downloading variants',
          ),
        }),
      )
      observer.complete()
    }, opts.stopToken)
  }

  async getSources() {
    const { parser } = await this.configure()
    const conf = this.getConf('samplesTsvLocation')
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
