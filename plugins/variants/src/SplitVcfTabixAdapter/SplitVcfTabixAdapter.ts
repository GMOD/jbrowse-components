import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getVcfSources, streamVcfFeatures } from '../shared/vcfAdapterUtils.ts'

import type { SplitVcfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class SplitVcfTabixAdapter extends BaseFeatureDataAdapter<SplitVcfTabixAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

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

  // Index-only compressed-byte estimate (no feature download). Each refName is
  // a separate file, so regions are grouped by refName and estimated against
  // their own index — used to short-circuit an over-budget region before
  // pulling every line (see executeRenderFeatureData).
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const byRef = new Map<string, Region[]>()
    for (const region of regions) {
      const list = byRef.get(region.refName)
      if (list) {
        list.push(region)
      } else {
        byRef.set(region.refName, [region])
      }
    }
    let total = 0
    for (const [refName, refRegions] of byRef) {
      const { vcf } = await this.configure(refName, opts)
      total += await vcf.bytesForRegions(refRegions, opts)
    }
    return total
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { vcf, parser } = await this.configure(query.refName, opts)
      await streamVcfFeatures(
        { vcf, parser, idPrefix: this.id },
        query,
        opts,
        observer,
      )
    }, opts.stopToken)
  }

  public async getExportData(
    regions: NoAssemblyRegion[],
    formatType: string,
    opts?: BaseOptions,
  ): Promise<string | undefined> {
    if (formatType !== 'vcf') {
      return undefined
    }

    const exportLines: string[] = []
    let headerWritten = false
    for (const region of regions) {
      const { vcf } = await this.configure(region.refName, opts)
      if (!headerWritten) {
        exportLines.push(...(await vcf.getHeader()).split('\n').filter(Boolean))
        headerWritten = true
      }
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

  async getSources() {
    const [refName] = Object.keys(this.getConf('vcfGzLocationMap'))
    const { parser } = await this.configure(refName!)
    return getVcfSources(
      this.getConf('samplesTsvLocation'),
      parser,
      this.pluginManager,
    )
  }
}
