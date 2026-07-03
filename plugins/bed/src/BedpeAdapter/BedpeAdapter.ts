import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import {
  buildPairedIntervalTree,
  intervalTreeFeatures,
} from '../adapterUtil.ts'
import { parseNamesFromHeader } from '../util.ts'
import { featureData } from './util.ts'

import type { BedpeAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, IntervalTree, Region } from '@jbrowse/core/util'

export default class BedpeAdapter extends BaseFeatureDataAdapter<BedpeAdapterConfig> {
  protected bedpeFeatures?: Promise<{
    header: string
    feats1: Record<string, string[]>
    feats2: Record<string, string[]>
  }>

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree<Feature> | undefined> | undefined
  > = {}

  public static capabilities = ['getFeatures', 'getRefNames']

  private async loadDataP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('bedpeLocation'), this.pluginManager),
      opts,
    )

    const headerLines: string[] = []
    const feats1: Record<string, string[]> = {}
    const feats2: Record<string, string[]> = {}
    parseLineByLine(
      buffer,
      line => {
        if (line.startsWith('#')) {
          headerLines.push(line)
        } else if (!line.startsWith('track') && !line.startsWith('browser')) {
          const cols = line.split('\t')
          const r1 = cols[0]!
          const r2 = cols[3]!
          ;(feats1[r1] ??= []).push(line)
          ;(feats2[r2] ??= []).push(line)
        }
        return true
      },
      opts?.statusCallback,
    )

    return {
      header: headerLines.join('\n'),
      feats1,
      feats2,
    }
  }

  private async loadData(opts: BaseOptions = {}) {
    this.bedpeFeatures ??= this.loadDataP(opts).catch((e: unknown) => {
      this.bedpeFeatures = undefined
      throw e
    })

    return this.bedpeFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { feats1, feats2 } = await this.loadData(opts)
    return [...new Set([...Object.keys(feats1), ...Object.keys(feats2)])]
  }

  async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  async getNames() {
    const columnNames: string[] = this.getConf('columnNames')
    if (columnNames.length) {
      return columnNames
    }
    const { header } = await this.loadData()
    return parseNamesFromHeader(header)
  }

  private async loadFeatureTreeP(refName: string) {
    const { feats1, feats2 } = await this.loadData()
    const names = await this.getNames()
    return buildPairedIntervalTree(
      feats1,
      feats2,
      refName,
      this.id,
      (line, uniqueId, flip) => featureData(line, uniqueId, flip, names),
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
