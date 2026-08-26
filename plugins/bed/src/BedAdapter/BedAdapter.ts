import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
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
  makeParser,
  resolveColumnNames,
} from '../util.ts'

import type { BedAdapterConfig } from './configSchema.ts'
import type BED from '@gmod/bed'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedAdapter extends BaseFeatureDataAdapter<BedAdapterConfig> {
  // No `label`: `fetchAndMaybeUnzip` narrates the download from inside.
  loadData = cachedSetup({ setup: opts => this.loadDataP(opts) })

  // the parser needs the column names, which come from the header, so it can
  // only be built once the file is loaded
  private getParser = cachedSetup({
    setup: async (): Promise<BED> =>
      makeParser({
        autoSql: this.getConf('autoSql'),
        columnNames: await this.getNames(),
      }),
  })

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
    return bucketBedLines(buffer, opts?.statusCallback)
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
    const { features } = await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = await this.getNames()
    const parser = await this.getParser()
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
