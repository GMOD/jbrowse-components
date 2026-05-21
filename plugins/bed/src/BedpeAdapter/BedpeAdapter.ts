import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { IntervalTree, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { parseNamesFromHeader } from '../util.ts'
import { featureData } from './util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedpeAdapter extends BaseFeatureDataAdapter {
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
        } else {
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
    const intervalTree = new IntervalTree<Feature>()

    for (const [i, f] of (feats1[refName] ?? []).entries()) {
      const obj = featureData(f, `${this.id}-${refName}-${i}-r1`, false, names)
      intervalTree.insert([obj.get('start'), obj.get('end')], obj)
    }
    for (const [i, f] of (feats2[refName] ?? []).entries()) {
      const obj = featureData(f, `${this.id}-${refName}-${i}-r2`, true, names)
      intervalTree.insert([obj.get('start'), obj.get('end')], obj)
    }

    return intervalTree
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
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureTree(refName)
      for (const f of intervalTree?.search([start, end]) ?? []) {
        observer.next(f)
      }
      observer.complete()
    }, opts.stopToken)
  }
}
