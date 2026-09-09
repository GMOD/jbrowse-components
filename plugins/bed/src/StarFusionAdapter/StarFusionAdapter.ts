import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'
import {
  parseStarFusionBreakpoint,
  starFusionColumns,
} from '@jbrowse/core/util/starFusion'

import {
  buildPairedIntervalTree,
  intervalTreeFeatures,
} from '../adapterUtil.ts'

import type { StarFusionAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, IntervalTree, Region } from '@jbrowse/core/util'

export default class StarFusionAdapter extends BaseFeatureDataAdapter<StarFusionAdapterConfig> {
  private loadData = cachedSetup({ setup: opts => this.loadDataP(opts) })

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree<Feature> | undefined> | undefined
  > = {}

  public static capabilities = ['getFeatures', 'getRefNames']

  private async loadDataP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('starFusionLocation'), this.pluginManager),
      opts,
    )

    let columnNames: string[] = []
    let leftIdx = -1
    let rightIdx = -1
    const feats1: Record<string, string[]> = {}
    const feats2: Record<string, string[]> = {}

    parseLineByLine(
      buffer,
      (line, lineIndex) => {
        if (lineIndex === 0) {
          columnNames = starFusionColumns(line)
          leftIdx = columnNames.indexOf('LeftBreakpoint')
          rightIdx = columnNames.indexOf('RightBreakpoint')
        } else if (!line.startsWith('#')) {
          const cols = line.split('\t')
          const left = cols[leftIdx]
          const right = cols[rightIdx]
          if (left && right) {
            const leftRef = parseStarFusionBreakpoint(left, true).refName
            const rightRef = parseStarFusionBreakpoint(right, false).refName
            ;(feats1[leftRef] ??= []).push(line)
            ;(feats2[rightRef] ??= []).push(line)
          }
        }
        return true
      },
      opts?.statusCallback,
    )

    return { columnNames, feats1, feats2 }
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { feats1, feats2 } = await this.loadData(opts)
    return [...new Set([...Object.keys(feats1), ...Object.keys(feats2)])]
  }

  private featureFromLine(
    line: string,
    columnNames: string[],
    uniqueId: string,
    flip: boolean,
  ): Feature {
    const cols = line.split('\t')
    const row = Object.fromEntries(
      columnNames.map((name, i) => [name, cols[i]]),
    )
    const donor = parseStarFusionBreakpoint(row.LeftBreakpoint!, true)
    const acceptor = parseStarFusionBreakpoint(row.RightBreakpoint!, false)
    const [primary, mate] = flip ? [acceptor, donor] : [donor, acceptor]
    return new SimpleFeature({
      uniqueId,
      ...primary,
      name: row.FusionName,
      score: row.JunctionReadCount ? +row.JunctionReadCount : undefined,
      type: 'fusion',
      mate,
      ...row,
    })
  }

  private async loadFeatureTreeP(refName: string) {
    const { columnNames, feats1, feats2 } = await this.loadData()
    return buildPairedIntervalTree(
      feats1,
      feats2,
      refName,
      this.id,
      (line, uniqueId, flip) =>
        this.featureFromLine(line, columnNames, uniqueId, flip),
    )
  }

  private async loadFeatureTree(refName: string) {
    this.intervalTrees[refName] ??= this.loadFeatureTreeP(refName).catch(
      (e: unknown) => {
        this.intervalTrees[refName] = undefined
        throw e
      },
    )
    return this.intervalTrees[refName]
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return intervalTreeFeatures(query, opts, refName =>
      this.loadFeatureTree(refName),
    )
  }
}
