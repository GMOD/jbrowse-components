import IntervalTree from '@flatten-js/interval-tree'
import VCF from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

// local
import VcfFeature from '../VcfFeature'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, Feature } from '@jbrowse/core/util'

type StatusCallback = (arg: string) => void

export default class VcfAdapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree> = {}

  vcfFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<string, (sc?: StatusCallback) => IntervalTree>
  }>

  public static capabilities = ['getFeatures', 'getRefNames']

  public async getHeader() {
    const { header } = await this.setup()
    return header
  }

  async getMetadata() {
    const { header } = await this.setup()
    const parser = new VCF({ header })
    return parser.getMetadata()
  }

  public async setupP(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const loc = openLocation(this.getConf('vcfLocation'), this.pluginManager)
    const buffer = await fetchAndMaybeUnzip(loc, opts)
    const headerLines = []
    const featureMap = {} as Record<string, string[]>
    let blockStart = 0

    const decoder = new TextDecoder('utf8')
    let i = 0
    while (blockStart < buffer.length) {
      const n = buffer.indexOf('\n', blockStart)
      // could be a non-newline ended file, so slice to end of file if n===-1
      const b =
        n === -1 ? buffer.subarray(blockStart) : buffer.subarray(blockStart, n)
      const line = decoder.decode(b).trim()
      if (line) {
        if (line.startsWith('#')) {
          headerLines.push(line)
        } else {
          const ret = line.indexOf('\t')
          const refName = line.slice(0, ret)
          if (!featureMap[refName]) {
            featureMap[refName] = []
          }
          featureMap[refName].push(line)
        }
      }
      if (i++ % 10_000 === 0) {
        statusCallback(
          `Loading ${Math.floor(blockStart / 1_000_000).toLocaleString('en-US')}/${Math.floor(buffer.length / 1_000_000).toLocaleString('en-US')} MB`,
        )
      }

      blockStart = n + 1
    }

    const header = headerLines.join('\n')
    const parser = new VCF({ header })

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
        intervalTreeMap[refName]?.(opts.statusCallback)
          .search([start, end])
          .forEach(f => {
            observer.next(f)
          })
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }

  public freeResources(): void {}
}
