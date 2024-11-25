import IntervalTree from '@flatten-js/interval-tree'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { parseStringSync } from 'gtf-nostream'

// locals
import { featureData } from '../util'
import type { FeatureLoc } from '../util'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

type StatusCallback = (arg: string) => void

export default class GtfAdapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree> = {}

  gtfFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<string, (sc?: StatusCallback) => IntervalTree>
  }>

  private async loadDataP(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const loc = openLocation(this.getConf('gtfLocation'), this.pluginManager)
    const buffer = await fetchAndMaybeUnzip(loc, opts)
    const headerLines = []
    const featureMap = {} as Record<string, string>
    let blockStart = 0

    let i = 0
    const decoder = new TextDecoder('utf8')
    while (blockStart < buffer.length) {
      const n = buffer.indexOf('\n', blockStart)
      // could be a non-newline ended file, so slice to end of file if n===-1
      const b =
        n === -1 ? buffer.subarray(blockStart) : buffer.subarray(blockStart, n)
      const line = decoder.decode(b).trim()
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
            ;(parseStringSync(lines) as FeatureLoc[][])
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
    }, opts.stopToken)
  }
  public freeResources(/* { region } */) {}
}
