import IntervalTree from '@flatten-js/interval-tree'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  SimpleFeature,
  doesIntersect2,
  fetchAndMaybeUnzip,
  getProgressDisplayStr,
  max,
  min,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { parseStringSync } from 'gtf-nostream'

import { featureData } from '../util'

import type { FeatureLoc } from '../util'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { Observer } from 'rxjs'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

type StatusCallback = (arg: string) => void

export default class GtfAdapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree> = {}

  gtfFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<string, (sc?: StatusCallback) => IntervalTree>
  }>

  private async loadDataP(opts?: BaseOptions) {
    const loc = openLocation(this.getConf('gtfLocation'), this.pluginManager)
    const buffer = await fetchAndMaybeUnzip(loc, opts)
    const headerLines = [] as string[]
    const featureMap = {} as Record<string, string>

    parseLineByLine(
      buffer,
      line => {
        if (line.startsWith('#')) {
          headerLines.push(line)
        } else if (line.startsWith('>')) {
          return false
        } else {
          const ret = line.indexOf('\t')
          const refName = line.slice(0, ret)
          if (!featureMap[refName]) {
            featureMap[refName] = ''
          }
          featureMap[refName] += `${line}\n`
        }
        return true
      },
      opts?.statusCallback,
    )

    const intervalTreeMap = Object.fromEntries(
      Object.entries(featureMap).map(([refName, lines]) => [
        refName,
        (sc?: (arg: string) => void) => {
          if (!this.calculatedIntervalTreeMap[refName]) {
            sc?.('Parsing GTF data')
            const intervalTree = new IntervalTree()
            for (const obj of (parseStringSync(lines) as FeatureLoc[][])
              .flat()
              .map((f, i) => featureData(f, `${this.id}-${refName}-${i}`))) {
              intervalTree.insert([obj.start as number, obj.end as number], obj)
            }

            this.calculatedIntervalTreeMap[refName] = intervalTree
          }
          return this.calculatedIntervalTreeMap[refName]
        },
      ]),
    )

    return {
      header: headerLines.join('\n'),
      intervalTreeMap,
    }
  }

  private async loadData(opts: BaseOptions = {}) {
    if (!this.gtfFeatures) {
      this.gtfFeatures = this.loadDataP(opts).catch((e: unknown) => {
        this.gtfFeatures = undefined
        throw e
      })
    }

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

  public async getFeaturesHelper({
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
    const aggregateField = this.getConf('aggregateField')
    const { start, end, refName } = query
    const { intervalTreeMap } = await this.loadData(opts)
    const feats = intervalTreeMap[refName]?.(opts.statusCallback).search([
      start,
      end,
    ])
    if (feats) {
      if (allowRedispatch && feats.length) {
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

      const parentAggregation = {} as Record<string, SimpleFeatureSerialized[]>

      if (feats.some(f => f.uniqueId === undefined)) {
        throw new Error('found uniqueId undefined')
      }
      for (const feat of feats) {
        const aggr = feat[aggregateField]
        if (!parentAggregation[aggr]) {
          parentAggregation[aggr] = []
        }

        if (aggr) {
          parentAggregation[aggr].push(feat)
        } else {
          observer.next(
            new SimpleFeature({
              id: feat.uniqueId,
              data: feat,
            }),
          )
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
