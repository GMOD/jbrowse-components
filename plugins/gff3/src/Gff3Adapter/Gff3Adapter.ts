import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { IntervalTree, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { groupLinesByRef } from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { parseStringSyncJBrowse } from 'gff-nostream'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { StatusCallback } from '@jbrowse/core/util/parseLineByLine'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class Gff3Adapter extends BaseFeatureDataAdapter {
  private gffFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<
      string,
      (sc?: StatusCallback) => IntervalTree<Feature>
    >
  }>

  private async loadDataP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('gffLocation'), this.pluginManager),
      opts,
    )

    const { headerLines, linesByRef } = groupLinesByRef(
      buffer,
      opts?.statusCallback,
    )

    const calculatedIntervalTreeMap: Record<string, IntervalTree<Feature>> = {}

    const intervalTreeMap = Object.fromEntries(
      Object.entries(linesByRef).map(([refName, refLines]) => {
        let lines: string[] | null = refLines
        return [
          refName,
          (sc?: StatusCallback) => {
            if (!calculatedIntervalTreeMap[refName]) {
              sc?.('Parsing GFF data')
              const intervalTree = new IntervalTree<Feature>()
              const features = parseStringSyncJBrowse(`${lines!.join('\n')}\n`)
              lines = null
              for (let i = 0; i < features.length; i++) {
                const f = features[i]!
                intervalTree.insert(
                  [f.start, f.end],
                  new SimpleFeature({
                    data: f,
                    id: `${this.id}-${refName}-${i}`,
                  }),
                )
              }
              calculatedIntervalTreeMap[refName] = intervalTree
            }
            return calculatedIntervalTreeMap[refName]
          },
        ]
      }),
    )

    return { header: headerLines.join('\n'), intervalTreeMap }
  }

  private async loadData(opts: BaseOptions) {
    this.gffFeatures ??= this.loadDataP(opts).catch((e: unknown) => {
      this.gffFeatures = undefined
      throw e
    })
    return this.gffFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData(opts)
    return Object.keys(intervalTreeMap)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const { intervalTreeMap } = await this.loadData(opts)
        const tree = intervalTreeMap[refName]
        if (tree) {
          for (const f of tree(opts.statusCallback).search([start, end])) {
            observer.next(f)
          }
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }
}
