import { BigBed, Header } from '@gmod/bbi'
import BED from '@gmod/bed'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { map, mergeAll } from 'rxjs/operators'

// locals
import { isUCSC, makeBlocks, ucscProcessedTranscript } from '../util'

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
    // @ts-expect-error
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

            if (r.uniqueId === undefined) {
              throw new Error('invalid bbi feature')
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
              ...rest
            } = data

            const f = {
              ...rest,
              uniqueId,
              type,
              start: r.start,
              end: r.end,
              refName,
            }
            const subfeatures = blockCount
              ? makeBlocks({
                  chromStarts,
                  blockStarts,
                  blockCount,
                  blockSizes,
                  start,
                  uniqueId,
                  refName,
                })
              : []

            // collection of heuristics for suggesting that this feature should
            // be converted to a gene, CNV bigbed has many gene like features
            // including thickStart and blockCount but no strand
            return new SimpleFeature({
              id: `${this.id}-${uniqueId}`,
              // @ts-expect-error
              data: isUCSC(f)
                ? ucscProcessedTranscript({
                    ...f,
                    chromStarts,
                    blockCount,
                    blockSizes,
                    thickStart,
                    thickEnd,
                    subfeatures,
                  })
                : { ...f, subfeatures },
            })
          }),
        ).subscribe(observer)
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

  public freeResources(): void {}
}
