import BED from '@gmod/bed'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  IntervalTree,
  SimpleFeature,
  fetchAndMaybeUnzip,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { intervalTreeFeatures } from '../adapterUtil.ts'
import {
  bedFeatureLocus,
  bucketBedLines,
  featureData,
  resolveColumnNames,
} from '../util.ts'

import type { BedAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedAdapter extends BaseFeatureDataAdapter<BedAdapterConfig> {
  protected bedFeatures?: Promise<{
    header: string
    features: Record<string, string[]>
    parser: BED
  }>

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree<Feature> | undefined> | undefined
  > = {}

  public static capabilities = ['getFeatures', 'getRefNames']

  private async loadDataP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('bedLocation'), this.pluginManager),
      opts,
    )
    const { header, features } = bucketBedLines(buffer, opts?.statusCallback)
    return {
      header,
      features,
      parser: new BED({ autoSql: this.getConf('autoSql') }),
    }
  }

  async loadData(opts: BaseOptions = {}) {
    this.bedFeatures ??= this.loadDataP(opts).catch((e: unknown) => {
      this.bedFeatures = undefined
      throw e
    })

    return this.bedFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { features } = await this.loadData(opts)
    return Object.keys(features)
  }

  async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  async getNames() {
    return resolveColumnNames(
      this.getConf('columnNames'),
      async () => (await this.loadData()).header,
    )
  }

  private async loadFeatureIntervalTreeHelper(refName: string) {
    const { features, parser } = await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = await this.getNames()
    const scoreColumn = this.getConf('scoreColumn')
    const colRef = this.getConf('colRef')
    const colStart = this.getConf('colStart')
    const colEnd = this.getConf('colEnd')
    const disableGeneHeuristic = this.getConf('disableGeneHeuristic')

    const intervalTree = new IntervalTree<Feature>()

    for (let i = 0; i < lines.length; i++) {
      const splitLine = lines[i]!.split('\t')
      const feat = new SimpleFeature(
        featureData({
          splitLine,
          ...bedFeatureLocus({ splitLine, colRef, colStart, colEnd }),
          scoreColumn,
          parser,
          uniqueId: `${this.id}-${refName}-${i}`,
          names,
          disableGeneHeuristic,
        }),
      )
      intervalTree.insert([feat.get('start'), feat.get('end')], feat)
    }

    return intervalTree
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

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return intervalTreeFeatures(query, opts, refName =>
      this.loadFeatureIntervalTree(refName),
    )
  }
}
