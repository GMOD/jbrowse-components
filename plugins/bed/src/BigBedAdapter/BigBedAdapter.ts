/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { SimpleFeature, Feature, Region } from '@jbrowse/core/util'
import { map, mergeAll } from 'rxjs/operators'

// locals
import { ucscProcessedTranscript } from '../util'

function isUCSC(f: Feature) {
  return f.get('thickStart') && f.get('blockCount') && f.get('strand') !== 0
}

export default class BigBedAdapter extends BaseFeatureDataAdapter {
  private cached?: Promise<{ bigbed: BigBed; header: any; parser: BED }>

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

  public getFeatures(region: Region, opts: BaseOptions = {}) {
    const { refName, start, end } = region
    const { signal } = opts
    return ObservableCreate<Feature>(async observer => {
      try {
        const { parser, bigbed } = await this.configure(opts)
        const ob = await bigbed.getFeatureStream(refName, start, end, {
          signal,
          basesPerSpan: end - start,
        })
        ob.pipe(
          mergeAll(),
          map(r => {
            const data = parser.parseLine(
              `${refName}\t${r.start}\t${r.end}\t${r.rest}`,
              {
                uniqueId: r.uniqueId!,
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
            const { chromStart, chromEnd, chrom, ...rest } = data

            const f = new SimpleFeature({
              id: `${this.id}-${r.uniqueId}`,
              data: {
                ...rest,
                start: r.start,
                end: r.end,
                refName,
              },
            })

            // collection of heuristics for suggesting that this feature
            // should be converted to a gene, CNV bigbed has many gene like
            // features including thickStart and blockCount but no strand
            return isUCSC(f) ? ucscProcessedTranscript(f) : f
          }),
        ).subscribe(observer)
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

  public freeResources(): void {}
}
