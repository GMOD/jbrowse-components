import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { IntervalTree, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { intervalTreeFeatures } from '../adapterUtil.ts'
import { makeBedGraphFeature } from '../bedGraphUtil.ts'
import { bucketBedLines, parseNamesFromHeader } from '../util.ts'

import type { BedGraphAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedGraphAdapter extends BaseFeatureDataAdapter<BedGraphAdapterConfig> {
  protected bedFeatures?: Promise<{
    header: string
    features: Record<string, string[]>
  }>

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree<Feature> | undefined> | undefined
  > = {}

  async getNames() {
    const columnNames: string[] = this.getConf('columnNames')
    if (columnNames.length) {
      return columnNames
    }
    const { header } = await this.loadData()
    return parseNamesFromHeader(header)
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
      const [refName, s, e, ...rest] = lines[i]!.split('\t')
      const start = +s!
      const end = +e!
      for (let j = 0, l2 = rest.length; j < l2; j++) {
        const feat = makeBedGraphFeature({
          uniqueId: `${this.id}-${refName}-${i}-${j}`,
          refName: refName!,
          start,
          end,
          names,
          j,
          value: rest[j]!,
        })
        if (feat) {
          intervalTree.insert([start, end], feat)
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
    return bucketBedLines(buffer, opts.statusCallback)
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
    return intervalTreeFeatures(query, opts, refName =>
      this.loadFeatureIntervalTree(refName),
    )
  }
}
