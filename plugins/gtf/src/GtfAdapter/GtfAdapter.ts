import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  groupLinesByRef,
  makeFeatureIntervalTreeMap,
} from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { aggregateGtfFeatures, parseGtfToFeatures } from '../util.ts'

import type { GtfAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export default class GtfAdapter extends BaseFeatureDataAdapter<GtfAdapterConfig> {
  private gtfFeatures?: ReturnType<GtfAdapter['loadDataP']>

  private async loadDataP(opts?: BaseOptions) {
    // the whole file is resident, so genes are aggregated once here and stored
    // in the interval tree already spanning all their transcripts; getFeatures
    // is then a plain tree search with no per-query aggregation or redispatch
    const aggregateField = this.getConf('aggregateField')
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('gtfLocation'), this.pluginManager),
      opts,
    )
    const { headerLines, linesByRef } = groupLinesByRef(
      buffer,
      opts?.statusCallback,
    )

    const intervalTreeMap = makeFeatureIntervalTreeMap<SimpleFeatureSerialized>(
      linesByRef,
      (lines, refName) =>
        aggregateGtfFeatures({
          feats: parseGtfToFeatures(
            lines.map(line => ({ line })),
            (_record, i) => `${this.id}-${refName}-${i}`,
          ),
          aggregateField,
          refName,
          idPrefix: this.id,
          // whole-ref bounds so nothing is clipped at load; the tree search in
          // getFeatures does the per-query clipping instead
          regionStart: 0,
          regionEnd: Number.MAX_SAFE_INTEGER,
        }),
      'Parsing GTF data',
    )

    return { header: headerLines.join('\n'), intervalTreeMap }
  }

  private async loadData(opts: BaseOptions = {}) {
    this.gtfFeatures ??= this.loadDataP(opts).catch((e: unknown) => {
      this.gtfFeatures = undefined
      throw e
    })
    return this.gtfFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData(opts)
    return Object.keys(intervalTreeMap)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { intervalTreeMap } = await this.loadData(opts)
        const tree = intervalTreeMap[query.refName]
        if (tree) {
          for (const feat of tree(opts.statusCallback).search([
            query.start,
            query.end,
          ])) {
            observer.next(new SimpleFeature({ id: feat.uniqueId, data: feat }))
          }
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }
}
