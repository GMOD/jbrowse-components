import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  SimpleFeature,
  doesIntersect2,
  max,
  min,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { firstValueFrom, toArray } from 'rxjs'

import { featureData2 } from '../util.ts'

import type { FeatureData } from '../util.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { Observer } from 'rxjs'

export default class BigBedAdapter extends BaseFeatureDataAdapter {
  private cachedP?: Promise<{
    bigbed: BigBed
    header: Awaited<ReturnType<BigBed['getHeader']>>
    parser: BED
  }>

  public async configurePre(opts?: BaseOptions) {
    const pm = this.pluginManager
    const bigbed = new BigBed({
      filehandle: openLocation(this.getConf('bigBedLocation'), pm),
    })
    const header = await bigbed.getHeader(opts)
    const parser = new BED({
      autoSql: header.autoSql,
    })
    return {
      bigbed,
      header,
      parser,
    }
  }

  public async configure(opts?: BaseOptions) {
    if (!this.cachedP) {
      this.cachedP = this.configurePre(opts).catch((e: unknown) => {
        this.cachedP = undefined
        throw e
      })
    }
    return this.cachedP
  }

  public async getRefNames(opts?: BaseOptions) {
    const { header } = await this.configure(opts)
    return Object.keys(header.refsByName)
  }

  // allow using BigBedAdapter for aliases with chromAlias.bb file from UCSC
  public async getRefNameAliases(opts?: BaseOptions) {
    const { header } = await this.configure(opts)
    const ret = await Promise.all(
      Object.keys(header.refsByName).map(
        async refName =>
          (
            await firstValueFrom(
              this.getFeatures({
                assemblyName: '',
                refName,
                start: 0,
                end: 1,
              }).pipe(toArray()),
            )
          )[0]!,
      ),
    )
    return ret
      .map(r => r.toJSON())
      .map(r => ({
        refName: r.ucsc,
        aliases: [r.ncbi, r.refseq, r.genbank],
        override: true,
      }))
  }

  public async getData() {
    const refNames = await this.getRefNames()
    const features = []
    for (const refName of refNames) {
      const f = await firstValueFrom(
        this.getFeatures({
          assemblyName: 'unknown',
          refName,
          start: 0,
          end: Number.MAX_SAFE_INTEGER,
        }).pipe(toArray()),
      )
      features.push(f)
    }
    return features.flat()
  }

  async getHeader(opts?: BaseOptions) {
    const { parser, header } = await this.configure(opts)
    const { version, fileType } = header
    const { fields, ...autoSql } = parser.autoSql
    return {
      version,
      fileType,
      autoSql,
      fields: await this.getMetadata(opts),
    }
  }
  async getMetadata(opts?: BaseOptions) {
    const { parser } = await this.configure(opts)
    const { fields } = parser.autoSql
    return Object.fromEntries(
      fields.map(({ name, comment }) => [name, comment]),
    )
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
    const { statusCallback = () => {} } = opts
    const scoreColumn = this.getConf('scoreColumn')
    const aggregateField = this.getConf('aggregateField')
    const disableGeneHeuristic = this.getConf('disableGeneHeuristic')
    const { parser, bigbed } = await updateStatus(
      'Downloading header',
      statusCallback,
      () => this.configure(opts),
    )
    const feats = await updateStatus(
      'Downloading features',
      statusCallback,
      () =>
        bigbed.getFeatures(query.refName, query.start, query.end, {
          basesPerSpan: query.end - query.start,
        }),
    )

    await updateStatus('Processing features', statusCallback, async () => {
      const parentAggregation = {} as Record<string, FeatureData[]>
      let minAggStart = Infinity
      let maxAggEnd = -Infinity

      for (const feat of feats) {
        const splitLine = [
          query.refName,
          `${feat.start}`,
          `${feat.end}`,
          ...(feat.rest?.split('\t') || []),
        ]
        const f = featureData2({
          scoreColumn,
          splitLine,
          parser,
          uniqueId: feat.uniqueId!,
          start: feat.start,
          end: feat.end,
          refName: query.refName,
          disableGeneHeuristic,
        })
        const aggr = f[aggregateField]
        const aggrIsNotNone =
          typeof aggr === 'string' && aggr && aggr !== 'none'
        if (aggrIsNotNone) {
          if (!parentAggregation[aggr]) {
            parentAggregation[aggr] = []
          }
          parentAggregation[aggr].push(f)
          if (f.start < minAggStart) {
            minAggStart = f.start
          }
          if (f.end > maxAggEnd) {
            maxAggEnd = f.end
          }
        } else {
          if (
            doesIntersect2(
              f.start,
              f.end,
              originalQuery.start,
              originalQuery.end,
            )
          ) {
            observer.next(
              new SimpleFeature({
                id: `${this.id}-${feat.uniqueId}`,
                data: f,
              }),
            )
          }
        }
      }

      if (allowRedispatch && maxAggEnd > -Infinity) {
        if (maxAggEnd > query.end || minAggStart < query.start) {
          await this.getFeaturesHelper({
            query: {
              ...query,
              // extend query to catch gene subfeatures outside the current view
              start: minAggStart - 500_000,
              end: maxAggEnd + 500_000,
            },
            opts,
            observer,
            allowRedispatch: false,
            originalQuery: query,
          })
          return
        }
      }

      for (const [name, subfeatures] of Object.entries(parentAggregation)) {
        const s = min(subfeatures.map(f => f.start))
        const e = max(subfeatures.map(f => f.end))
        if (doesIntersect2(s, e, originalQuery.start, originalQuery.end)) {
          const subs = subfeatures.sort((a, b) =>
            a.uniqueId.localeCompare(b.uniqueId),
          )
          // overlapping subs → one gene parent; non-overlapping → separate parents
          // (handles bacterial GFF where two genes share a name but are distinct loci)
          const sortedByStart = [...subs].sort((a, b) => a.start - b.start)
          const hasOverlaps = sortedByStart.some(
            (f, i) => i > 0 && sortedByStart[i - 1]!.end > f.start,
          )
          if (hasOverlaps) {
            observer.next(
              new SimpleFeature({
                id: `${this.id}-${subs[0]?.uniqueId}-parent`,
                data: {
                  type: 'gene',
                  subfeatures: subs,
                  strand: subs.find(s => s.strand !== 0)?.strand ?? 1,
                  name,
                  start: s,
                  end: e,
                  refName: query.refName,
                },
              }),
            )
          } else {
            for (const sub of subs) {
              observer.next(
                new SimpleFeature({
                  id: `${this.id}-${sub.uniqueId}-parent`,
                  data: {
                    type: 'gene',
                    subfeatures: [sub],
                    strand: subs.find(s => s.strand !== 0)?.strand ?? 1,
                    name,
                    start: sub.start,
                    end: sub.end,
                    refName: query.refName,
                  },
                }),
              )
            }
          }
        }
      }
    })

    observer.complete()
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
}
