import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, updateStatus } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getVcfSources, streamVcfFeatures } from '../shared/vcfAdapterUtils.ts'

import type { VcfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class VcfTabixAdapter extends BaseFeatureDataAdapter<VcfTabixAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

  configure = cachedSetup({
    label: 'Downloading index',
    setup: () => this.configurePre(),
  })

  private async configurePre() {
    const vcfGzLocation = this.getConf('vcfGzLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])
    const vcf = new TabixIndexedFile({
      filehandle: openLocation(vcfGzLocation, this.pluginManager),
      ...openTabixIndexFilehandle(location, indexType, this.pluginManager),
      chunkCacheBudget: decompressedBytesBudget,
      bgzfWorkerPool: sharedBgzfWorkerPool(),
    })
    const header = await vcf.getHeader()
    return {
      vcf,
      parser: new VcfParser({ header }),
      header,
    }
  }

  // Index-only compressed-byte estimate (no feature download), used by the
  // single-region feature-fetch RPC to short-circuit an over-budget region
  // before pulling every line — see executeRenderFeatureData.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { vcf } = await this.configure(opts)
    return vcf.bytesForRegions(regions, opts)
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

  // The sources plus whatever the samples metadata file disagreed with the VCF
  // header about; `getSources` is the base-class contract and drops the
  // warnings, `MultiSampleVariantGetSources` takes this one so the display can
  // report them.
  async getSourcesAndWarnings() {
    const { parser } = await this.configure()
    return getVcfSources(
      this.getConf('samplesTsvLocation'),
      parser,
      this.pluginManager,
    )
  }

  async getSources() {
    return (await this.getSourcesAndWarnings()).sources
  }
}
