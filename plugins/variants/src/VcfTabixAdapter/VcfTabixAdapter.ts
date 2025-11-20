import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  fetchAndMaybeUnzipText,
  shorten2,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import VcfFeature from '../VcfFeature'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class VcfTabixAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

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

  public async getExportData(
    regions: NoAssemblyRegion[],
    formatType: string,
    opts?: BaseOptions,
  ): Promise<string | undefined> {
    if (formatType !== 'vcf') {
      return undefined
    }

    const { statusCallback = () => {} } = opts || {}
    const { vcf } = await this.configure(opts)
    const headerText = await vcf.getHeader()
    const exportLines: string[] = headerText.split('\n').filter(Boolean)

    for (const region of regions) {
      const { refName, start, end } = region
      const regionLines: string[] = []

      await updateStatus('Exporting variants', statusCallback, () =>
        vcf.getLines(refName, start, end, {
          lineCallback: (line: string) => {
            regionLines.push(line)
          },
          ...opts,
        }),
      )

      exportLines.push(...regionLines)
    }

    return exportLines.join('\n')
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
      const metadataLines = lines
        .slice(1)
        .filter(f => !!f)
        .map(line => {
          const [name, ...rest] = line.split('\t')
          return {
            ...Object.fromEntries(
              // force col 0 to be called name
              header.slice(1).map((c, idx) => [c, rest[idx] || ''] as const),
            ),
            name: name!,
          }
        })
      const vcfSampleSet = new Set(parser.samples)
      const metadataSet = new Set(metadataLines.map(r => r.name))
      const metadataNotInVcfSamples = [...metadataSet].filter(
        f => !vcfSampleSet.has(f),
      )
      const vcfSamplesNotInMetadata = [...vcfSampleSet].filter(
        f => !metadataSet.has(f),
      )
      if (metadataNotInVcfSamples.length) {
        console.warn(
          `There are ${metadataNotInVcfSamples.length} samples in metadata file (${metadataLines.length} lines) not in VCF (${parser.samples.length} samples):`,
          shorten2(metadataNotInVcfSamples.join(',')),
        )
      }
      if (vcfSamplesNotInMetadata.length) {
        console.warn(
          `There are ${vcfSamplesNotInMetadata.length} samples in VCF file (${parser.samples.length} samples) not in metadata file (${metadataLines.length} lines):`,
          shorten2(vcfSamplesNotInMetadata.map(m => m).join(',')),
        )
      }
      return metadataLines.filter(f => vcfSampleSet.has(f.name))
    }
  }
}
