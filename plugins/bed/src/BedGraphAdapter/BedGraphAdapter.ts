import IntervalTree from '@flatten-js/interval-tree'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

export default class BedGraphAdapter extends BaseFeatureDataAdapter {
  protected bedFeatures?: Promise<{
    header: string
    features: Record<string, string[]>
    columnNames: string[]
  }>

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree | undefined> | undefined
  > = {}

  async getNames() {
    const { header, columnNames } = await this.loadData()
    if (columnNames.length) {
      return columnNames
    }
    const defs = header.split(/\n|\r\n|\r/).filter(f => !!f)
    const defline = defs.at(-1)
    return defline?.includes('\t')
      ? defline
          .slice(1)
          .split('\t')
          .map(field => field.trim())
      : undefined
  }
  private async loadFeatureIntervalTreeHelper(refName: string) {
    const { features } = await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = (await this.getNames())?.slice(3) || []
    const intervalTree = new IntervalTree()
    // eslint-disable-next-line unicorn/no-for-loop
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const [refName, s, e, ...rest] = line.split('\t')
      // eslint-disable-next-line unicorn/no-for-loop
      for (let j = 0; j < rest.length; j++) {
        const uniqueId = `${this.id}-${refName}-${i}-${j}`
        const start = +s!
        const end = +e!
        const score = +rest[j]!
        const source = names[j] || `col${j}`
        if (score) {
          intervalTree.insert(
            [start, end],
            new SimpleFeature({
              id: uniqueId,
              data: {
                refName,
                start,
                end,
                score,
                source,
              },
            }),
          )
        }
      }
    }

    return intervalTree
  }
  public async getRefNames(opts: BaseOptions = {}) {
    const { features } = await this.loadData(opts)
    return Object.keys(features)
  }
  private async loadDataP(opts: BaseOptions = {}) {
    const pm = this.pluginManager
    const bedLoc = this.getConf('bedGraphLocation')
    const buffer = await fetchAndMaybeUnzip(openLocation(bedLoc, pm), opts)
    const features = {} as Record<string, string[]>
    const headerLines = [] as string[]
    parseLineByLine(
      buffer,
      line => {
        if (line.startsWith('#')) {
          headerLines.push(line)
        } else {
          const tab = line.indexOf('\t')
          const refName = line.slice(0, tab)
          if (!features[refName]) {
            features[refName] = []
          }
          features[refName].push(line)
        }
        return true
      },
      opts.statusCallback,
    )

    const columnNames = this.getConf('columnNames')

    return {
      header: headerLines.join('\n'),
      features,
      columnNames,
    }
  }

  async loadFeatureIntervalTree(refName: string) {
    if (!this.intervalTrees[refName]) {
      this.intervalTrees[refName] = this.loadFeatureIntervalTreeHelper(
        refName,
      ).catch((e: unknown) => {
        this.intervalTrees[refName] = undefined
        throw e
      })
    }
    return this.intervalTrees[refName]
  }

  async loadData(opts: BaseOptions = {}) {
    if (!this.bedFeatures) {
      this.bedFeatures = this.loadDataP(opts).catch((e: unknown) => {
        this.bedFeatures = undefined
        throw e
      })
    }

    return this.bedFeatures
  }
  public getFeatures(query: Region, _opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureIntervalTree(refName)
      for (const feature of intervalTree?.search([start, end]) || []) {
        observer.next(feature)
      }
      observer.complete()
    })
  }
}
