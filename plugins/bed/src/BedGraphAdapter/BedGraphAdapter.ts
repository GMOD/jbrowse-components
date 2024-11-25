import IntervalTree from '@flatten-js/interval-tree'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip, SimpleFeature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedGraphAdapter extends BaseFeatureDataAdapter {
  protected bedFeatures?: Promise<{
    header: string
    features: Record<string, string[]>
    columnNames: string[]
  }>

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree | undefined> | undefined
  > = {}

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
    const { features } = await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = (await this.getNames())?.slice(3) || []
    const intervalTree = new IntervalTree()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const [refName, s, e, ...rest] = line.split('\t')
      for (let j = 0; j < rest.length; j++) {
        const uniqueId = `${this.id}-${refName}-${i}-${j}`
        const start = +s!
        const end = +e!
        const score = +rest[j]!
        const source = names[j] || `col${j}`
        if (score) {
          intervalTree.insert(
            [start, end],
            new SimpleFeature({
              id: uniqueId,
              data: {
                refName,
                start,
                end,
                score,
                source,
              },
            }),
          )
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
    const pm = this.pluginManager
    const bedLoc = this.getConf('bedGraphLocation')
    const buffer = await fetchAndMaybeUnzip(openLocation(bedLoc, pm), opts)
    // 512MB  max chrome string length is 512MB
    if (buffer.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const data = new TextDecoder('utf8', { fatal: true }).decode(buffer)
    const lines = data.split(/\n|\r\n|\r/).filter(f => !!f)
    const headerLines = []
    let i = 0
    for (; i < lines.length && lines[i]!.startsWith('#'); i++) {
      headerLines.push(lines[i])
    }
    const header = headerLines.join('\n')
    const features = {} as Record<string, string[]>
    for (; i < lines.length; i++) {
      const line = lines[i]!
      const tab = line.indexOf('\t')
      const refName = line.slice(0, tab)
      if (!features[refName]) {
        features[refName] = []
      }
      features[refName].push(line)
    }

    const columnNames = this.getConf('columnNames')

    return {
      header,
      features,
      columnNames,
    }
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

  async loadData(opts: BaseOptions = {}) {
    if (!this.bedFeatures) {
      this.bedFeatures = this.loadDataP(opts).catch((e: unknown) => {
        this.bedFeatures = undefined
        throw e
      })
    }

    return this.bedFeatures
  }
  public getFeatures(query: Region, _opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureIntervalTree(refName)
      intervalTree?.search([start, end]).forEach(f => {
        observer.next(f)
      })
      observer.complete()
    })
  }

  public freeResources(): void {}
}
