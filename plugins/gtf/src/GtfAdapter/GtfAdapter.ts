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

function getRedispatchBounds(
  feats: SimpleFeatureSerialized[],
  aggregateField: string,
) {
  let minStart = Number.POSITIVE_INFINITY
  let maxEnd = Number.NEGATIVE_INFINITY
  let hasAnyAggregateField = false
  for (const feat of feats) {
    if (feat.start < minStart) {
      minStart = feat.start
    }
    if (feat.end > maxEnd) {
      maxEnd = feat.end
    }
    if (feat[aggregateField]) {
      hasAnyAggregateField = true
    }
  }
  return { minStart, maxEnd, hasAnyAggregateField }
}

export default class GtfAdapter extends BaseFeatureDataAdapter<GtfAdapterConfig> {
  private gtfFeatures?: ReturnType<GtfAdapter['loadDataP']>

  private async loadDataP(opts?: BaseOptions) {
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
        parseGtfToFeatures(
          lines.map(line => ({ line })),
          (_record, i) => `${this.id}-${refName}-${i}`,
        ),
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
        const aggregateField = this.getConf('aggregateField')
        const { intervalTreeMap } = await this.loadData(opts)
        const tree = intervalTreeMap[query.refName]
        if (tree) {
          const search = tree(opts.statusCallback)
          let feats = search.search([query.start, query.end])

          // the interval tree already holds fully-built features, so redispatch
          // only to pull in sibling transcripts of an aggregated gene that fall
          // outside the view; widen by 500kb to catch distant ones
          const { minStart, maxEnd, hasAnyAggregateField } = getRedispatchBounds(
            feats,
            aggregateField,
          )
          if (
            hasAnyAggregateField &&
            (maxEnd > query.end || minStart < query.start)
          ) {
            feats = search.search([minStart - 500_000, maxEnd + 500_000])
          }

          const aggregated = aggregateGtfFeatures({
            feats,
            aggregateField,
            refName: query.refName,
            regionStart: query.start,
            regionEnd: query.end,
          })
          for (const feat of aggregated) {
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
