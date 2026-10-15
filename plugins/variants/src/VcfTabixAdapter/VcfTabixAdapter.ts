import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSamplesTsvSources } from '@jbrowse/core/util/samplesTsv'

import {
  appendVcfLines,
  streamVcfFeatures,
  vcfContigs,
} from '../shared/vcfAdapterUtils.ts'

import type { VcfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class VcfTabixAdapter extends BaseFeatureDataAdapter<VcfTabixAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

  // set once the file is open, for dataAdapterCache's eviction to clear
  private file?: TabixIndexedFile

  freeResources() {
    this.file?.clearChunkCache()
  }

  configure = cachedSetup({
    label: 'Downloading index',
    setup: opts => this.configurePre(opts),
  })

  private async configurePre(opts: BaseOptions) {
    const vcfGzLocation = this.getConf('vcfGzLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])
    const vcf = new TabixIndexedFile({
      filehandle: openLocation(vcfGzLocation, this.pluginManager),
      ...openTabixIndexFilehandle(location, indexType, this.pluginManager),
      chunkCacheBudget: decompressedBytesBudget,
      bgzfWorkerPool: sharedBgzfWorkerPool(),
    })
    this.file = vcf
    await vcf.getMetadata({ signal: opts.signal })
    return { vcf }
  }

  // the header read is sized from the index, so it can start only once the
  // index is in; the region read needs the same index and nothing else, so
  // getFeatures runs the two together
  private headerAndParser = cachedSetup({
    setup: async opts => {
      const { vcf } = await this.configure(opts)
      const header = await vcf.getHeader({ signal: opts.signal })
      return { header, parser: new VcfParser({ header }) }
    },
  })

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

  async getContigs(opts: BaseOptions = {}) {
    const [refNames, metadata] = await Promise.all([
      this.getRefNames(opts),
      this.getMetadata(opts),
    ])
    return vcfContigs(refNames, metadata)
  }

  async getHeader(opts?: BaseOptions) {
    return (await this.headerAndParser(opts)).header
  }

  async getMetadata(opts?: BaseOptions) {
    const { parser } = await this.headerAndParser(opts)
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

    const { vcf } = await this.configure(opts)
    const { header } = await this.headerAndParser(opts)
    const exportLines: string[] = header.split('\n').filter(Boolean)

    await appendVcfLines(exportLines, vcf, regions, opts)

    return exportLines.join('\n')
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { vcf } = await this.configure(opts)
      const parser = this.headerAndParser(opts).then(r => r.parser)
      await streamVcfFeatures(
        { vcf, parser, idPrefix: this.id },
        query,
        opts,
        observer,
      )
    }, opts.signal)
  }

  // The sources plus whatever the samples metadata file disagreed with the VCF
  // header about; `getSources` is the base-class contract and drops the
  // warnings, `MultiSampleVariantGetSources` takes this one so the display can
  // report them.
  async getSourcesAndWarnings(opts?: BaseOptions) {
    const { parser } = await this.headerAndParser(opts)
    return getSamplesTsvSources({
      location: this.getConf('samplesTsvLocation'),
      names: parser.samples,
      namesLabel: 'the VCF',
      pluginManager: this.pluginManager,
      opts,
    })
  }

  async getSources(_regions: Region[], opts?: BaseOptions) {
    return (await this.getSourcesAndWarnings(opts)).sources
  }
}
