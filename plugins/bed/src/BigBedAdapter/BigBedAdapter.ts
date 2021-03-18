/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region, FileLocation } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { map, mergeAll } from 'rxjs/operators'
import { readConfObject } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import configSchema from './configSchema'
import { ucscProcessedTranscript } from '../util'

interface BEDFeature {
  chrom: string
  chromStart: number
  chromEnd: number
  [key: string]: any
}

interface Parser {
  parseLine: (line: string, opts: { uniqueId: string | number }) => BEDFeature
}

export default class BigBedAdapter extends BaseFeatureDataAdapter {
  private bigbed: BigBed

  private parser: Promise<Parser>

  public constructor(config: Instance<typeof configSchema>) {
    super(config)
    const bigBedLocation = readConfObject(
      config,
      'bigBedLocation',
    ) as FileLocation
    this.bigbed = new BigBed({
      filehandle: openLocation(bigBedLocation),
    })

    this.parser = this.bigbed
      .getHeader()
      .then(({ autoSql }: { autoSql: string }) => new BED({ autoSql }))
  }

  public async getRefNames() {
    return Object.keys((await this.bigbed.getHeader()).refsByName)
  }

  async getHeader(opts?: BaseOptions) {
    const { version, fileType } = await this.bigbed.getHeader(opts)
    // @ts-ignore
    const { autoSql } = await this.parser
    const { fields, ...rest } = autoSql
    const f = Object.fromEntries(
      // @ts-ignore
      fields.map(({ name, comment }) => [name, comment]),
    )
    return { version, fileType, autoSql: { ...rest }, fields: f }
  }

  public async refIdToName(refId: number) {
    return ((await this.bigbed.getHeader()).refsByNumber[refId] || {}).name
  }

  public getFeatures(region: Region, opts: BaseOptions = {}) {
    const { refName, start, end } = region
    const { signal } = opts
    return ObservableCreate<Feature>(async observer => {
      try {
        const parser = await this.parser
        const ob = await this.bigbed.getFeatureStream(refName, start, end, {
          signal,
          basesPerSpan: end - start,
        })
        ob.pipe(
          mergeAll(),
          map(
            (r: {
              start: number
              end: number
              rest?: string
              uniqueId?: string
            }) => {
              const data = parser.parseLine(
                `${refName}\t${r.start}\t${r.end}\t${r.rest}`,
                {
                  uniqueId: r.uniqueId as string,
                },
              )

              const { blockCount, blockSizes, blockStarts, chromStarts } = data
              if (blockCount) {
                const starts = chromStarts || blockStarts || []
                const sizes = blockSizes
                const blocksOffset = r.start
                data.subfeatures = []

                for (let b = 0; b < blockCount; b += 1) {
                  const bmin = (starts[b] || 0) + blocksOffset
                  const bmax = bmin + (sizes[b] || 0)
                  data.subfeatures.push({
                    uniqueId: `${r.uniqueId}-${b}`,
                    start: bmin,
                    end: bmax,
                    type: 'block',
                  })
                }
              }
              if (r.uniqueId === undefined) {
                throw new Error('invalid bbi feature')
              }
              delete data.chromStart
              delete data.chromEnd
              delete data.chrom

              const f = new SimpleFeature({
                id: `${this.id}-${r.uniqueId}`,
                data: {
                  ...data,
                  start: r.start,
                  end: r.end,
                  refName,
                },
              })

              // collection of heuristics for suggesting that this feature
              // should be converted to a gene, CNV bigbed has many gene like
              // features including thickStart and blockCount but no strand
              return f.get('thickStart') &&
                f.get('blockCount') &&
                f.get('strand') !== 0
                ? ucscProcessedTranscript(f)
                : f
            },
          ),
        ).subscribe(observer)
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

  public freeResources(): void {}
}
