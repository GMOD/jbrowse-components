import { BigBed, Header } from '@gmod/bbi'
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
} from '@jbrowse/core/util'
import { Observer } from 'rxjs'
import { SimpleFeatureSerializedNoId } from '@jbrowse/core/util/simpleFeature'

// locals
import {
  isUcscProcessedTranscript,
  makeBlocks,
  ucscProcessedTranscript,
} from '../util'

export default class BigBedAdapter extends BaseFeatureDataAdapter {
  private cached?: Promise<{ bigbed: BigBed; header: Header; parser: BED }>

  public async configurePre(opts?: BaseOptions) {
    const pm = this.pluginManager
    const bigbed = new BigBed({
      filehandle: openLocation(this.getConf('bigBedLocation'), pm),
    })
    const header = await bigbed.getHeader(opts)
    const parser = new BED({ autoSql: header.autoSql })
    return { bigbed, header, parser }
  }

  public async configure(opts?: BaseOptions) {
    if (!this.cached) {
      this.cached = this.configurePre(opts).catch(e => {
        this.cached = undefined
        throw e
      })
    }
    return this.cached
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

  public async getFeaturesHelper(
    query: Region,
    opts: BaseOptions = {},
    observer: Observer<Feature>,
    allowRedispatch: boolean,
    originalQuery = query,
  ) {
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
      let minStart = Infinity
      let maxEnd = -Infinity
      for (const feat of feats) {
        if (feat.start < minStart) {
          minStart = feat.start
        }
        if (feat.end > maxEnd) {
          maxEnd = feat.end
        }
      }
      if (maxEnd > query.end || minStart < query.start) {
        await this.getFeaturesHelper(
          { ...query, start: minStart, end: maxEnd },
          opts,
          observer,
          false,
          query,
        )
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
        chromStart,
        chromStarts,
        blockStarts,
        blockCount,
        blockSizes,
        chromEnd,
        thickStart,
        thickEnd,
        chrom,
        score,
        ...rest
      } = data

      const subfeatures = blockCount
        ? makeBlocks({
            chromStarts,
            blockStarts,
            blockCount,
            blockSizes,
            uniqueId,
            refName: query.refName,
            start: feat.start,
          })
        : []

      if (isUcscProcessedTranscript(data)) {
        const f = ucscProcessedTranscript({
          ...rest,
          uniqueId,
          type,
          start: feat.start,
          end: feat.end,
          refName: query.refName,
          score: scoreColumn ? +data[scoreColumn] : score,
          chromStarts,
          blockCount,
          blockSizes,
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
                uniqueId,
                type,
                start: feat.start,
                score: scoreColumn ? +data[scoreColumn] : score,
                end: feat.end,
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
        const { uniqueId, strand } = subfeatures[0]
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
        await this.getFeaturesHelper(query, opts, observer, true)
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

  public freeResources(): void {}
}
