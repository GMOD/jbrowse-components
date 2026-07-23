import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getVcfSources, streamVcfFeatures } from '../shared/vcfAdapterUtils.ts'

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

  // true once the index has finished downloading; gates the status label so
  // pan/zoom re-entry into configure() doesn't re-flash "Downloading index"
  private configureReady = false

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
        .then(header => {
          this.configureReady = true
          return {
            vcf,
            parser: new VcfParser({ header }),
            header,
          }
        })
        .catch((e: unknown) => {
          this.configured = undefined
          throw e
        })
    }
    return this.configured
  }

  // Show "Downloading index" only while the index is genuinely downloading. Once
  // configured, callers (every getFeatures/byte-estimate on pan/zoom) await the
  // cached promise silently rather than re-flashing the label.
  async configure(opts?: BaseOptions) {
    return this.configureReady
      ? this.configureOnce()
      : updateStatus('Downloading index', opts?.statusCallback, () =>
          this.configureOnce(),
        )
  }

  // Index-only compressed-byte estimate (no feature download), used by the
  // single-region feature-fetch RPC to short-circuit an over-budget region
  // before pulling every line — see executeRenderFeatureData.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { vcf } = await this.configure(opts)
    return vcf.bytesForRegions(regions, opts)
  }

  async getMultiRegionByteEstimate(regions: Region[], opts?: BaseOptions) {
    return {
      bytes: await this.getRegionByteSize(regions, opts),
      fetchSizeLimit: this.getConf('fetchSizeLimit'),
    }
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { vcf } = await this.configure(opts)
    return downloadStatus(
      'Downloading index',
      opts.statusCallback,
      onProgress => vcf.getReferenceSequenceNames({ ...opts, onProgress }),
    )
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
      const { vcf, parser } = await this.configure(opts)
      await streamVcfFeatures(
        { vcf, parser, idPrefix: this.id },
        query,
        opts,
        observer,
      )
    }, opts.stopToken)
  }

  async getSources() {
    const { parser } = await this.configure()
    return getVcfSources(
      this.getConf('samplesTsvLocation'),
      parser,
      this.pluginManager,
    )
  }
}
