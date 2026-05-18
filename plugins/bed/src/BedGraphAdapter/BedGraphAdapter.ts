import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  IntervalTree,
  SimpleFeature,
  fetchAndMaybeUnzip,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { bucketBedLines, parseNamesFromHeader } from '../util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedGraphAdapter extends BaseFeatureDataAdapter {
  protected bedFeatures?: Promise<{
    header: string
    features: Record<string, string[]>
    columnNames: string[]
  }>

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree<Feature> | undefined> | undefined
  > = {}

  async getNames() {
    const { header, columnNames } = await this.loadData()
    return columnNames.length ? columnNames : parseNamesFromHeader(header)
  }
  private async loadFeatureIntervalTreeHelper(refName: string) {
    const { features } = await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = (await this.getNames())?.slice(3) ?? []
    const intervalTree = new IntervalTree<Feature>()
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i]!
      const [refName, s, e, ...rest] = line.split('\t')

      for (let j = 0, l2 = rest.length; j < l2; j++) {
        const uniqueId = `${this.id}-${refName}-${i}-${j}`
        const start = +s!
        const end = +e!
        const score = +rest[j]!
        const source = names[j] || `col${j}`
        if (!Number.isNaN(score)) {
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
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('bedGraphLocation'), this.pluginManager),
      opts,
    )
    const { header, features } = bucketBedLines(buffer, opts.statusCallback)
    return {
      header,
      features,
      columnNames: this.getConf('columnNames'),
    }
  }

  async loadFeatureIntervalTree(refName: string) {
    this.intervalTrees[refName] ??= this.loadFeatureIntervalTreeHelper(
      refName,
    ).catch((e: unknown) => {
      this.intervalTrees[refName] = undefined
      throw e
    })
    return this.intervalTrees[refName]
  }

  async loadData(opts: BaseOptions = {}) {
    this.bedFeatures ??= this.loadDataP(opts).catch((e: unknown) => {
      this.bedFeatures = undefined
      throw e
    })

    return this.bedFeatures
  }
  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureIntervalTree(refName)
      for (const feature of intervalTree?.search([start, end]) ?? []) {
        observer.next(feature)
      }
      observer.complete()
    }, opts.stopToken)
  }
}
