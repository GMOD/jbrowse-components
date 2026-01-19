import { IntervalTree } from '@flatten-js/interval-tree'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { featureData } from './util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedpeAdapter extends BaseFeatureDataAdapter {
  protected bedpeFeatures?: Promise<{
    header: string
    feats1: Record<string, string[]>
    feats2: Record<string, string[]>
    columnNames: string[]
  }>

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  protected intervalTrees: Record<
    string,
    Promise<IntervalTree<Feature> | undefined> | undefined
  > = {}

  public static capabilities = ['getFeatures', 'getRefNames']

  private async loadDataP(opts?: BaseOptions) {
    const data = await fetchAndMaybeUnzipText(
      openLocation(this.getConf('bedpeLocation'), this.pluginManager),
      opts,
    )

    const lines = data.split(/\n|\r\n|\r/).filter(f => !!f)
    const headerLines = []
    let i = 0
    for (; i < lines.length && lines[i]!.startsWith('#'); i++) {
      headerLines.push(lines[i])
    }
    const header = headerLines.join('\n')
    const feats1 = {} as Record<string, string[]>
    const feats2 = {} as Record<string, string[]>
    for (; i < lines.length; i++) {
      const line = lines[i]!
      const cols = line.split('\t')
      const r1 = cols[0]!
      const r2 = cols[3]!
      if (!feats1[r1]) {
        feats1[r1] = []
      }
      if (!feats2[r2]) {
        feats2[r2] = []
      }
      feats1[r1].push(line)
      feats2[r2].push(line)
    }
    const columnNames = this.getConf('columnNames')

    return {
      header,
      feats1,
      feats2,
      columnNames,
    }
  }

  private async loadData(opts: BaseOptions = {}) {
    if (!this.bedpeFeatures) {
      this.bedpeFeatures = this.loadDataP(opts).catch((e: unknown) => {
        this.bedpeFeatures = undefined
        throw e
      })
    }

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

  private async loadFeatureTreeP(refName: string) {
    const { feats1, feats2 } = await this.loadData()
    const names = await this.getNames()
    const intervalTree = new IntervalTree<Feature>()
    const ret1 =
      feats1[refName]?.map((f, i) =>
        featureData(f, `${this.id}-${refName}-${i}-r1`, false, names),
      ) ?? []
    const ret2 =
      feats2[refName]?.map((f, i) =>
        featureData(f, `${this.id}-${refName}-${i}-r2`, true, names),
      ) ?? []

    for (const obj of [...ret1, ...ret2]) {
      intervalTree.insert([obj.get('start'), obj.get('end')], obj)
    }

    return intervalTree
  }

  private async loadFeatureTree(refName: string) {
    if (!this.intervalTrees[refName]) {
      this.intervalTrees[refName] = this.loadFeatureTreeP(refName).catch(
        (e: unknown) => {
          this.intervalTrees[refName] = undefined
          throw e
        },
      )
    }
    return this.intervalTrees[refName]
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureTree(refName)
      for (const f of intervalTree?.search([start, end]) || []) {
        observer.next(f)
      }
      observer.complete()
    }, opts.stopToken)
  }
}
