import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  SimpleFeature,
  doesIntersect2,
  fetchAndMaybeUnzip,
  max,
  min,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  groupLinesByRef,
  makeFeatureIntervalTreeMap,
} from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { parseStringSync } from 'gtf-nostream'

import { featureData } from '../util.ts'

import type { FeatureLoc } from '../util.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
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
        (parseStringSync(lines.join('\n')) as FeatureLoc[][])
          .flat()
          .map(
            (f, i) =>
              featureData(f, `${this.id}-${refName}-${i}`) as SimpleFeatureSerialized,
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

      const parentAggregation: Record<string, SimpleFeatureSerialized[]> = {}
      for (const feat of feats) {
        const aggr = feat[aggregateField] as string
        if (aggr) {
          ;(parentAggregation[aggr] ??= []).push(feat)
        } else {
          observer.next(new SimpleFeature({ id: feat.uniqueId, data: feat }))
        }
      }

      for (const [name, subfeatures] of Object.entries(parentAggregation)) {
        const s = min(subfeatures.map(f => f.start))
        const e = max(subfeatures.map(f => f.end))
        if (doesIntersect2(s, e, originalQuery.start, originalQuery.end)) {
          const { uniqueId, strand } = subfeatures[0]!
          observer.next(
            new SimpleFeature({
              id: `${uniqueId}-parent`,
              data: {
                type: 'gene',
                subfeatures,
                strand,
                name,
                start: s,
                end: e,
                refName: query.refName,
              },
            }),
          )
        }
      }
    }
    observer.complete()
  }
}
