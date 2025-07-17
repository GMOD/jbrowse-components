import IntervalTree from '@flatten-js/interval-tree'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import VcfFeature from '../VcfFeature'
import { parseVcfBuffer } from './vcfParser'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

type StatusCallback = (arg: string) => void

export default class VcfAdapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree> = {}

  vcfFeatures?: Promise<{
    header: string
    parser: VcfParser
    intervalTreeMap: Record<string, (sc?: StatusCallback) => IntervalTree>
  }>

  public static capabilities = ['getFeatures', 'getRefNames']

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
        (sc?: (arg: string) => void) => {
          if (!this.calculatedIntervalTreeMap[refName]) {
            sc?.('Parsing VCF data')
            let idx = 0
            const intervalTree = new IntervalTree()
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
      try {
        const { start, end, refName } = region
        const { intervalTreeMap } = await this.setup()
        for (const f of intervalTreeMap[refName]?.(opts.statusCallback).search([
          start,
          end,
        ]) || []) {
          observer.next(f)
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
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
