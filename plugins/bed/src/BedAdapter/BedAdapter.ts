import BED from '@gmod/bed'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  IntervalTree,
  SimpleFeature,
  fetchAndMaybeUnzip,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { bucketBedLines, featureData, parseNamesFromHeader } from '../util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedAdapter extends BaseFeatureDataAdapter {
  protected bedFeatures?: Promise<{
    header: string
    features: Record<string, string[]>
    parser: BED
    columnNames: string[]
    scoreColumn: string
    colRef: number
    colStart: number
    colEnd: number
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
      columnNames: this.getConf('columnNames'),
      scoreColumn: this.getConf('scoreColumn'),
      colRef: this.getConf('colRef'),
      colStart: this.getConf('colStart'),
      colEnd: this.getConf('colEnd'),
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
    const { header, columnNames } = await this.loadData()
    return columnNames.length ? columnNames : parseNamesFromHeader(header)
  }

  private async loadFeatureIntervalTreeHelper(refName: string) {
    const { colRef, colStart, colEnd, features, parser, scoreColumn } =
      await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = await this.getNames()
    const disableGeneHeuristic = this.getConf('disableGeneHeuristic')

    const intervalTree = new IntervalTree<Feature>()

    for (let i = 0; i < lines.length; i++) {
      const splitLine = lines[i]!.split('\t')
      const feat = new SimpleFeature(
        featureData({
          splitLine,
          refName: splitLine[colRef]!,
          start: +splitLine[colStart]!,
          end: +splitLine[colEnd]! + (colStart === colEnd ? 1 : 0),
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
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureIntervalTree(refName)
      for (const f of intervalTree?.search([start, end]) ?? []) {
        observer.next(f)
      }
      observer.complete()
    }, opts.stopToken)
  }
}
