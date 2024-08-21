import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import IntervalTree from '@flatten-js/interval-tree'
import {
  SimpleFeature,
  Feature,
  updateStatus,
  isGzip,
} from '@jbrowse/core/util'
import { unzip } from '@gmod/bgzf-filehandle'
import gtf from '@gmod/gtf'

// locals
import { FeatureLoc, featureData } from '../util'

const decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined

type StatusCallback = (arg: string) => void

export default class GtfAdapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree> = {}

  gtfFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<string, (sc?: StatusCallback) => IntervalTree>
  }>

  private async loadDataP(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const buf = (await openLocation(
      this.getConf('gtfLocation'),
      this.pluginManager,
    ).readFile(opts)) as Buffer

    const buffer = isGzip(buf)
      ? await updateStatus('Unzipping', statusCallback, () => unzip(buf))
      : buf
    const headerLines = []
    const featureMap = {} as Record<string, string>
    let blockStart = 0

    let i = 0
    while (blockStart < buffer.length) {
      const n = buffer.indexOf('\n', blockStart)
      // could be a non-newline ended file, so slice to end of file if n===-1
      const b =
        n === -1 ? buffer.slice(blockStart) : buffer.slice(blockStart, n)
      const line = (decoder?.decode(b) || b.toString()).trim()
      if (line) {
        if (line.startsWith('#')) {
          headerLines.push(line)
        } else if (line.startsWith('>')) {
          break
        } else {
          const ret = line.indexOf('\t')
          const refName = line.slice(0, ret)
          if (!featureMap[refName]) {
            featureMap[refName] = ''
          }
          featureMap[refName] += `${line}\n`
        }
      }
      if (i++ % 10_000 === 0) {
        statusCallback(
          `Loading ${Math.floor(blockStart / 1_000_000).toLocaleString('en-US')}/${Math.floor(buffer.length / 1_000_000).toLocaleString('en-US')} MB`,
        )
      }

      blockStart = n + 1
    }

    const intervalTreeMap = Object.fromEntries(
      Object.entries(featureMap).map(([refName, lines]) => [
        refName,
        (sc?: (arg: string) => void) => {
          if (!this.calculatedIntervalTreeMap[refName]) {
            sc?.('Parsing GTF data')
            const intervalTree = new IntervalTree()
            ;(
              gtf.parseStringSync(lines, {
                parseFeatures: true,
                parseComments: false,
                parseDirectives: false,
                parseSequences: false,
              }) as FeatureLoc[][]
            )
              .flat()
              .map(
                (f, i) =>
                  new SimpleFeature({
                    data: featureData(f),
                    id: `${this.id}-${refName}-${i}`,
                  }),
              )
              .forEach(obj =>
                intervalTree.insert([obj.get('start'), obj.get('end')], obj),
              )
            this.calculatedIntervalTreeMap[refName] = intervalTree
          }
          return this.calculatedIntervalTreeMap[refName]
        },
      ]),
    )

    return {
      header: headerLines.join('\n'),
      intervalTreeMap,
    }
  }

  private async loadData(opts: BaseOptions = {}) {
    if (!this.gtfFeatures) {
      this.gtfFeatures = this.loadDataP(opts).catch((e: unknown) => {
        this.gtfFeatures = undefined
        throw e
      })
    }

    return this.gtfFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData(opts)
    return Object.keys(intervalTreeMap)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const { intervalTreeMap } = await this.loadData(opts)
        intervalTreeMap[refName]?.(opts.statusCallback)
          .search([start, end])
          .forEach(f => {
            observer.next(f)
          })
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }
  public freeResources(/* { region } */) {}
}
