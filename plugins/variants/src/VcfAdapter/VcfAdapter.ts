import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  IntervalTree,
  fetchAndMaybeUnzip,
  fetchAndMaybeUnzipText,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { groupLinesByRef } from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import VcfFeature from '../VcfFeature/index.ts'
import { parseSamplesTsv } from '../shared/parseSamplesTsv.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StatusCallback } from '@jbrowse/core/util/parseLineByLine'
import type { VcfAdapterConfig } from './configSchema.ts'

export default class VcfAdapter extends BaseFeatureDataAdapter<VcfAdapterConfig> {
  private vcfFeatures?: Promise<{
    header: string
    parser: VcfParser
    intervalTreeMap: Record<
      string,
      (sc?: StatusCallback) => IntervalTree<Feature>
    >
    featureMap: Record<string, string[]>
  }>

  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

  public async getHeader() {
    const { header } = await this.setup()
    return header
  }

  async getMetadata() {
    const { parser } = await this.setup()
    return parser.getMetadata()
  }

  private async setupP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('vcfLocation'), this.pluginManager),
      opts,
    )

    const { headerLines, linesByRef: featureMap } = groupLinesByRef(
      buffer,
      opts?.statusCallback,
    )
    const header = headerLines.join('\n')
    const parser = new VcfParser({ header })
    const calculatedIntervalTreeMap: Record<string, IntervalTree<Feature>> = {}

    const intervalTreeMap = Object.fromEntries(
      Object.entries(featureMap).map(([refName, lines]) => [
        refName,
        (sc?: StatusCallback) => {
          if (!calculatedIntervalTreeMap[refName]) {
            sc?.('Parsing VCF data')
            let idx = 0
            const intervalTree = new IntervalTree<Feature>()
            for (const line of lines) {
              const f = new VcfFeature({
                variant: parser.parseLine(line),
                parser,
                id: `${this.id}-${refName}-${idx++}`,
              })
              intervalTree.insert([f.get('start'), f.get('end')], f)
            }
            calculatedIntervalTreeMap[refName] = intervalTree
          }
          return calculatedIntervalTreeMap[refName]
        },
      ]),
    )

    return { header, parser, intervalTreeMap, featureMap }
  }

  private async setup() {
    this.vcfFeatures ??= this.setupP().catch((e: unknown) => {
      this.vcfFeatures = undefined
      throw e
    })
    return this.vcfFeatures
  }

  public async getRefNames(_: BaseOptions = {}) {
    const { intervalTreeMap } = await this.setup()
    return Object.keys(intervalTreeMap)
  }

  public getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = region
      const { intervalTreeMap } = await this.setup()
      const tree = intervalTreeMap[refName]
      if (tree) {
        for (const f of tree(opts.statusCallback).search([start, end])) {
          observer.next(f)
        }
      }
      observer.complete()
    }, opts.stopToken)
  }

  public async getExportData(
    regions: Region[],
    formatType: string,
    _opts?: BaseOptions,
  ): Promise<string | undefined> {
    if (formatType !== 'vcf') {
      return undefined
    }

    const { header, featureMap } = await this.setup()
    const exportLines: string[] = [header]

    for (const region of regions) {
      const { refName, start, end } = region
      const lines = featureMap[refName]
      if (lines) {
        for (const line of lines) {
          // POS is 1-based in VCF; convert to 0-based for comparison
          const fields = line.split('\t')
          const pos = parseInt(fields[1]!, 10)
          if (pos - 1 >= start && pos - 1 < end) {
            exportLines.push(line)
          }
        }
      }
    }

    return exportLines.join('\n')
  }

  async getSources() {
    const { parser } = await this.setup()
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
