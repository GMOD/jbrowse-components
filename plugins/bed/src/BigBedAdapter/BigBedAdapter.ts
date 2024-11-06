import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  doesIntersect2,
  max,
  min,
  Feature,
  SimpleFeature,
  SimpleFeatureSerializedNoId,
} from '@jbrowse/core/util'
import { Observer } from 'rxjs'

// locals
import {
  isUcscProcessedTranscript,
  ucscProcessedTranscript,
  makeBlocks,
  arrayify,
} from '../util'

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
    const { signal } = opts
    const scoreColumn = this.getConf('scoreColumn')
    const aggregateField = this.getConf('aggregateField')
    const { parser, bigbed } = await this.configure(opts)
    const feats = await bigbed.getFeatures(
      query.refName,
      query.start,
      query.end,
      {
        signal,
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

    const parentAggregation = {} as Record<
      string,
      SimpleFeatureSerializedNoId[]
    >

    if (feats.some(f => f.uniqueId === undefined)) {
      throw new Error('found uniqueId undefined')
    }
    for (const feat of feats) {
      const data = parser.parseLine(
        `${query.refName}\t${feat.start}\t${feat.end}\t${feat.rest}`,
        { uniqueId: feat.uniqueId! },
      )

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
      const chromStarts = arrayify(chromStarts2)
      const blockStarts = arrayify(blockStarts2)
      const blockSizes = arrayify(blockSizes2)
      const score = scoreColumn ? +data[scoreColumn] : +score2

      const subfeatures = makeBlocks({
        chromStarts,
        blockStarts,
        blockSizes,
        blockCount,
        uniqueId,
        refName: query.refName,
        start: feat.start,
      })

      if (
        isUcscProcessedTranscript({
          strand,
          blockCount,
          thickStart,
        })
      ) {
        const f = ucscProcessedTranscript({
          ...rest,
          strand,
          uniqueId,
          type,
          start: feat.start,
          end: feat.end,
          refName: query.refName,
          score,
          chromStarts: chromStarts!,
          blockSizes: blockSizes!,
          blockCount,
          thickStart,
          thickEnd,
          subfeatures,
        })
        if (aggr) {
          parentAggregation[aggr].push(f)
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
              new SimpleFeature({ id: `${this.id}-${uniqueId}`, data: f }),
            )
          }
        }
      } else {
        if (
          doesIntersect2(
            feat.start,
            feat.end,
            originalQuery.start,
            originalQuery.end,
          )
        ) {
          observer.next(
            new SimpleFeature({
              id: `${this.id}-${uniqueId}`,
              data: {
                ...rest,
                start: feat.start,
                end: feat.end,
                strand,
                uniqueId,
                type,
                score,
                refName: query.refName,
                subfeatures,
              },
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
    }, opts.signal)
  }

  public freeResources(): void {}
}
