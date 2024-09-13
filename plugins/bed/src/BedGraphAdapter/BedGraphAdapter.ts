import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Region, Feature } from '@jbrowse/core/util'
import BedAdapter from '../BedAdapter/BedAdapter'
import IntervalTree from '@flatten-js/interval-tree'
import { featureData } from '../util'

export default class BedGraphAdapter extends BedAdapter {
  async loadFeatureIntervalTreeHelper(refName: string) {
    const { colRef, colStart, colEnd, features, parser, scoreColumn } =
      await this.loadData()
    const lines = features[refName]
    if (!lines) {
      return undefined
    }
    const names = await this.getNames()

    const intervalTree = new IntervalTree()
    const ret = lines.map((f, i) => {
      const uniqueId = `${this.id}-${refName}-${i}`
      return featureData(
        f,
        colRef,
        colStart,
        colEnd,
        scoreColumn,
        parser,
        uniqueId,
        names,
      )
    })

    for (const obj of ret) {
      intervalTree.insert([obj.get('start'), obj.get('end')], obj)
    }
    return intervalTree
  }
  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureIntervalTree(refName)
      intervalTree?.search([start, end]).forEach(f => {
        console.log({ f })
        observer.next(f)
      })
      observer.complete()
    }, opts.signal)
  }

  public freeResources(): void {}
}
