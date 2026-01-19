import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { IntervalTree, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { parseVcfBuffer } from './vcfParser.ts'
import VcfFeature from '../VcfFeature/index.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StatusCallback } from '@jbrowse/core/util/parseLineByLine'

export default class VcfAdapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree<Feature>> = {}

  vcfFeatures?: Promise<{
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

  public async setupP(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const loc = openLocation(this.getConf('vcfLocation'), this.pluginManager)
    const buffer = await fetchAndMaybeUnzip(loc, opts)

    const { header, featureMap } = parseVcfBuffer(buffer, statusCallback)
    const parser = new VcfParser({ header })

    const intervalTreeMap = Object.fromEntries(
      Object.entries(featureMap).map(([refName, lines]) => [
        refName,
        (sc?: StatusCallback) => {
          if (!this.calculatedIntervalTreeMap[refName]) {
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
            this.calculatedIntervalTreeMap[refName] = intervalTree
          }
          return this.calculatedIntervalTreeMap[refName]
        },
      ]),
    )

    return {
      header,
      parser,
      intervalTreeMap,
      featureMap,
    }
  }

  public async setup() {
    if (!this.vcfFeatures) {
      this.vcfFeatures = this.setupP().catch((e: unknown) => {
        this.vcfFeatures = undefined
        throw e
      })
    }
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
      for (const f of intervalTreeMap[refName]?.(opts.statusCallback).search([
        start,
        end,
      ]) || []) {
        observer.next(f)
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
      const lines = featureMap[refName] || []

      for (const line of lines) {
        // VCF format: CHROM POS ID REF ALT QUAL FILTER ...
        // Extract POS (second field, 1-based)
        const fields = line.split('\t')
        const pos = parseInt(fields[1]!, 10)

        // VCF positions are 1-based, convert to 0-based for comparison
        // and check if overlaps with region
        if (pos - 1 >= start && pos - 1 < end) {
          exportLines.push(line)
        }
      }
    }

    return exportLines.join('\n')
  }

  async getSources() {
    const conf = this.getConf('samplesTsvLocation')
    if (conf.uri === '' || conf.uri === '/path/to/samples.tsv') {
      const { parser } = await this.setup()
      return parser.samples.map(name => ({
        name,
      }))
    } else {
      const txt = await openLocation(conf).readFile('utf8')
      const lines = txt.split(/\n|\r\n|\r/)
      const header = lines[0]!.split('\t')
      const { parser } = await this.setup()
      const s = new Set(parser.samples)
      return lines
        .slice(1)
        .filter(Boolean)
        .map(line => {
          const cols = line.split('\t')
          return {
            name: cols[0]!,
            ...Object.fromEntries(
              cols.slice(1).map((c, idx) => [header[idx + 1]!, c] as const),
            ),
          }
        })
        .filter(f => s.has(f.name))
    }
  }
}
