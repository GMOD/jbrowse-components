import IntervalTree from '@flatten-js/interval-tree'
import BED from '@gmod/bed'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  SimpleFeature,
  fetchAndMaybeUnzip,
  getProgressDisplayStr,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { featureData } from '../util'

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
    Promise<IntervalTree | undefined> | undefined
  > = {}

  public static capabilities = ['getFeatures', 'getRefNames']

  private async loadDataP(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const bedLoc = this.getConf('bedLocation')
    const buffer = await fetchAndMaybeUnzip(
      openLocation(bedLoc, this.pluginManager),
      opts,
    )

    const headerLines = []
    const features = {} as Record<string, string[]>
    let blockStart = 0
    let i = 0
    const decoder = new TextDecoder('utf8')
    while (blockStart < buffer.length) {
      const n = buffer.indexOf(10, blockStart)
      // could be a non-newline ended file, so subarray to end of file if n===-1
      const b =
        n === -1 ? buffer.subarray(blockStart) : buffer.subarray(blockStart, n)
      const line = decoder.decode(b).trim()
      if (line) {
        if (line.startsWith('#')) {
          headerLines.push(line)
        } else if (line.startsWith('>')) {
          break
        } else {
          const tab = line.indexOf('\t')
          const refName = line.slice(0, tab)
          if (!features[refName]) {
            features[refName] = []
          }
          features[refName].push(line)
        }
      }
      if (i++ % 10_000 === 0) {
        statusCallback(
          `Loading ${getProgressDisplayStr(blockStart, buffer.length)}`,
        )
      }
      blockStart = n + 1
    }
    const header = headerLines.join('\n')

    const autoSql = this.getConf('autoSql') as string
    const parser = new BED({ autoSql })
    const columnNames = this.getConf('columnNames')
    const scoreColumn = this.getConf('scoreColumn')
    const colRef = this.getConf('colRef')
    const colStart = this.getConf('colStart')
    const colEnd = this.getConf('colEnd')

    return {
      header,
      features,
      parser,
      columnNames,
      scoreColumn,
      colRef,
      colStart,
      colEnd,
    }
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
    const { colRef, colStart, colEnd, features, parser, scoreColumn } =
      await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = await this.getNames()

    const intervalTree = new IntervalTree()
    // eslint-disable-next-line unicorn/no-for-loop
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const uniqueId = `${this.id}-${refName}-${i}`
      const feat = new SimpleFeature(
        featureData({
          line,
          colRef,
          colStart,
          colEnd,
          scoreColumn,
          parser,
          uniqueId,
          names,
        }),
      )
      intervalTree.insert([feat.get('start'), feat.get('end')], feat)
    }

    return intervalTree
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

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureIntervalTree(refName)
      const features = intervalTree?.search([start, end])
      if (features) {
        for (const f of features) {
          observer.next(f)
        }
      }
      observer.complete()
    }, opts.stopToken)
  }
}
