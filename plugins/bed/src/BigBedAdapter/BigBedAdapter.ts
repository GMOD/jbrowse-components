import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { doesIntersect2, max, min, SimpleFeature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { firstValueFrom, toArray } from 'rxjs'

// locals
import { featureData2 } from '../util'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
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
    const { fields, ...rest } = parser.autoSql
    return {
      version,
      fileType,
      autoSql: { ...rest },
      fields: Object.fromEntries(
        fields.map(({ name, comment }) => [name, comment]),
      ),
    }
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
    const { stopToken } = opts
    const scoreColumn = this.getConf('scoreColumn')
    const aggregateField = this.getConf('aggregateField')
    const { parser, bigbed } = await this.configure(opts)
    const feats = await bigbed.getFeatures(
      query.refName,
      query.start,
      query.end,
      {
        stopToken,
        basesPerSpan: query.end - query.start,
      },
    )
    if (allowRedispatch && feats.length) {
      let minStart = Number.POSITIVE_INFINITY
      let maxEnd = Number.NEGATIVE_INFINITY
      for (const feat of feats) {
        if (feat.start < minStart) {
          minStart = feat.start
        }
        if (feat.end > maxEnd) {
          maxEnd = feat.end
        }
      }
      if (maxEnd > query.end || minStart < query.start) {
        await this.getFeaturesHelper({
          query: {
            ...query,
            start: minStart,
            end: maxEnd,
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
      const line = `${query.refName}\t${feat.start}\t${feat.end}\t${feat.rest}`
      const data = parser.parseLine(line, { uniqueId: feat.uniqueId! })

      const aggr = data[aggregateField]
      if (!parentAggregation[aggr]) {
        parentAggregation[aggr] = []
      }
      const {
        uniqueId,
        type,
        chrom,
        chromStart,
        chromEnd,
        description,
        chromStarts: chromStarts2,
        blockStarts: blockStarts2,
        blockSizes: blockSizes2,
        score: score2,
        blockCount,
        thickStart,
        thickEnd,
        strand,
        ...rest
      } = data

      const f = featureData2({
        ...rest,
        scoreColumn,
        line,
        parser,
        uniqueId,
        start: feat.start,
        end: feat.end,
        refName: query.refName,
      })
      if (aggr) {
        parentAggregation[aggr].push(f)
      } else {
        if (
          doesIntersect2(f.start, f.end, originalQuery.start, originalQuery.end)
        ) {
          observer.next(
            new SimpleFeature({
              id: `${this.id}-${uniqueId}`,
              data: f,
            }),
          )
        }
      }
    }

    Object.entries(parentAggregation).map(([name, subfeatures]) => {
      const s = min(subfeatures.map(f => f.start))
      const e = max(subfeatures.map(f => f.end))
      if (doesIntersect2(s, e, originalQuery.start, originalQuery.end)) {
        const { uniqueId, strand } = subfeatures[0]!
        observer.next(
          new SimpleFeature({
            id: `${this.id}-${uniqueId}-parent`,
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

  public freeResources(): void {}
}
