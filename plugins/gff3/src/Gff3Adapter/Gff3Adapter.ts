import { IntervalTree } from '@flatten-js/interval-tree'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { parseStringSync } from 'gff-nostream'

import { featureData } from '../featureData'
import { parseGffBuffer } from './gffParser'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

type StatusCallback = (arg: string) => void

export default class Gff3Adapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree<Feature>> = {}

  gffFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<
      string,
      (sc?: StatusCallback) => IntervalTree<Feature>
    >
  }>

  private async loadDataP(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('gffLocation'), this.pluginManager),
      opts,
    )

    const { header, featureMap } = parseGffBuffer(buffer, statusCallback)

    const intervalTreeMap = Object.fromEntries(
      Object.entries(featureMap).map(([refName, lines]) => [
        refName,
        (sc?: (arg: string) => void) => {
          if (!this.calculatedIntervalTreeMap[refName]) {
            sc?.('Parsing GFF data')
            const intervalTree = new IntervalTree<Feature>()
            for (const obj of parseStringSync(lines)
              .flat()
              .map(
                (f, i) =>
                  new SimpleFeature({
                    data: featureData(f),
                    id: `${this.id}-${refName}-${i}`,
                  }),
              )) {
              intervalTree.insert([obj.get('start'), obj.get('end')], obj)
            }

            this.calculatedIntervalTreeMap[refName] = intervalTree
          }
          return this.calculatedIntervalTreeMap[refName]
        },
      ]),
    )

    return {
      header,
      intervalTreeMap,
    }
  }

  private async loadData(opts: BaseOptions) {
    if (!this.gffFeatures) {
      this.gffFeatures = this.loadDataP(opts).catch((e: unknown) => {
        this.gffFeatures = undefined
        throw e
      })
    }

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
        for (const f of intervalTreeMap[refName]?.(opts.statusCallback).search([
          start,
          end,
        ]) || []) {
          observer.next(f)
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }
}
