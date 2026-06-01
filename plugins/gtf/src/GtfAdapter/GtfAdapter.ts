import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  IntervalTree,
  SimpleFeature,
  fetchAndMaybeUnzip,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { groupLinesByRef } from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { aggregateGtfFeatures, featureData, parseGtf } from '../util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { StatusCallback } from '@jbrowse/core/util/parseLineByLine'
import type { Region } from '@jbrowse/core/util/types'
import type { Observer } from 'rxjs'

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

export default class GtfAdapter extends BaseFeatureDataAdapter {
  private gtfFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<
      string,
      (sc?: StatusCallback) => IntervalTree<SimpleFeatureSerialized>
    >
  }>

  private async loadDataP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('gtfLocation'), this.pluginManager),
      opts,
    )
    const { headerLines, linesByRef } = groupLinesByRef(
      buffer,
      opts?.statusCallback,
    )

    const calculatedIntervalTreeMap: Record<
      string,
      IntervalTree<SimpleFeatureSerialized>
    > = {}

    const intervalTreeMap = Object.fromEntries(
      Object.entries(linesByRef).map(([refName, refLines]) => {
        let lines: string[] | null = refLines
        return [
          refName,
          (sc?: StatusCallback) => {
            if (!calculatedIntervalTreeMap[refName]) {
              sc?.('Parsing GTF data')
              const intervalTree = new IntervalTree<SimpleFeatureSerialized>()
              const parsed = parseGtf(lines!.join('\n')).map((f, i) =>
                featureData(f, `${this.id}-${refName}-${i}`),
              )
              lines = null
              for (const obj of parsed) {
                intervalTree.insert(
                  [obj.start as number, obj.end as number],
                  obj as SimpleFeatureSerialized,
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
        await this.getFeaturesHelper({
          query,
          opts,
          observer,
          allowRedispatch: true,
        })
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }

  private async getFeaturesHelper({
    query,
    opts,
    observer,
    allowRedispatch,
    originalQuery = query,
  }: {
    query: Region
    opts: BaseOptions
    observer: Observer<Feature>
    allowRedispatch: boolean
    originalQuery?: Region
  }) {
    const aggregateField = this.getConf('aggregateField') as string
    const { start, end, refName } = query
    const { intervalTreeMap } = await this.loadData(opts)
    const tree = intervalTreeMap[refName]
    if (tree) {
      const feats = tree(opts.statusCallback).search([start, end])

      if (allowRedispatch && feats.length) {
        const { minStart, maxEnd, hasAnyAggregateField } = getRedispatchBounds(
          feats,
          aggregateField,
        )
        if (
          hasAnyAggregateField &&
          (maxEnd > query.end || minStart < query.start)
        ) {
          await this.getFeaturesHelper({
            query: {
              ...query,
              // re-query with 500kb added onto start and end, in order to catch
              // gene subfeatures that may not overlap your view
              start: minStart - 500_000,
              end: maxEnd + 500_000,
            },
            opts,
            observer,
            allowRedispatch: false,
            originalQuery: query,
          })
          return
        }
      }

      const aggregated = aggregateGtfFeatures({
        feats,
        aggregateField,
        refName: query.refName,
        regionStart: originalQuery.start,
        regionEnd: originalQuery.end,
      })
      for (const feat of aggregated) {
        observer.next(new SimpleFeature({ id: feat.uniqueId, data: feat }))
      }
    }
    observer.complete()
  }
}
