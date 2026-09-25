import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { IntervalTree, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { intervalTreeFeatures } from '../adapterUtil.ts'
import { makeBedGraphFeature } from '../bedGraphUtil.ts'
import { bucketBedLines, resolveColumnNames } from '../util.ts'

import type { BedGraphAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedGraphAdapter extends BaseFeatureDataAdapter<BedGraphAdapterConfig> {
  // No `label`: `fetchAndMaybeUnzip` narrates the download from inside.
  loadData = cachedSetup({ setup: opts => this.loadDataP(opts) })

  async getNames() {
    return resolveColumnNames(
      this.getConf('columnNames'),
      async () => (await this.loadData()).header,
    )
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

  private treeFeatures = intervalTreeFeatures(
    opts => this.loadData(opts),
    refName => this.loadFeatureIntervalTreeHelper(refName),
  )

  public getFeatures(query: Region, opts?: BaseOptions) {
    return this.treeFeatures(query, opts)
  }
}
