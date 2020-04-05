/* eslint-disable @typescript-eslint/no-explicit-any */
import BED from '@gmod/bed'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { GenericFilehandle } from 'generic-filehandle'
import { ucscProcessedTranscript } from '../util'

interface BEDFeature {
  chrom: string
  chromStart: number
  chromEnd: number
  [key: string]: any
}
interface AlreadyRegularizedFeature {
  refName: string
  start: number
  end: number
}
interface RegularizedFeature {
  refName: string
  start: number
  end: number
}

export default class BedTabixAdapter extends BaseAdapter {
  private parser: any

  protected bed: TabixIndexedFile

  protected filehandle: GenericFilehandle

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    bedGzLocation: IFileLocation

    index: {
      indexType?: string
      location: IFileLocation
    }
    autoSql: string
  }) {
    super()
    const { bedGzLocation, index, autoSql } = config
    const { location, indexType } = index

    this.filehandle = openLocation(bedGzLocation)
    this.bed = new TabixIndexedFile({
      filehandle: this.filehandle,
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      tbiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })

    this.parser = new BED({ autoSql })
  }

  async parseBed(bedLocation: IFileLocation) {
    return ((await openLocation(bedLocation).readFile('utf8')) as string)
      .split('\n')
      .map((row, index) => {
        this.parser.parseLine(row, { uniqueId: `row${index}` })
      })
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.bed.getReferenceSequenceNames(opts)
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(query: IRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      await this.bed.getLines(query.refName, query.start, query.end, {
        lineCallback: (line: string, fileOffset: number) => {
          const l = line.split('\t')
          const refName = +l[0]
          const start = +l[1]
          const end = +l[2]
          const uniqueId = `bed-${fileOffset}`
          const data = this.parser.parseLine(line, {
            uniqueId,
          })

          const { blockCount, blockSizes, blockStarts, chromStarts } = data

          if (blockCount) {
            const starts = chromStarts || blockStarts || []
            const sizes = blockSizes
            const blocksOffset = start
            data.subfeatures = []

            for (let b = 0; b < blockCount; b += 1) {
              const bmin = (starts[b] || 0) + blocksOffset
              const bmax = bmin + (sizes[b] || 0)
              data.subfeatures.push({
                uniqueId: `${uniqueId}-${b}`,
                start: bmin,
                end: bmax,
                type: 'block',
              })
            }
          }
          const f = new SimpleFeature({
            id: data.uniqueId,
            data: {
              ...data,
              start,
              end,
              refName,
            },
          })
          const r = f.get('thickStart') ? ucscProcessedTranscript(f) : f
          observer.next(r)
        },
        signal: opts.signal,
      })
      observer.complete()
    })
  }
  // /**
  //  * Fetch features for a certain region
  //  * @param {IRegion} param
  //  * @param abortSignal an abortSignal
  //  * @returns {Observable[Feature]} Observable of Feature objects in the region
  //  */
  // public getFeatures(
  //   region: IRegion,
  //   opts: BaseOptions = {},
  // ): Observable<Feature> {
  //   const { refName, start, end } = region
  //   const { signal } = opts
  //   return ObservableCreate(async (observer: Observer<Feature>) => {
  //     try {
  //       const parser = await this.parser
  //       const ob = await this.bigbed.getFeatureStream(refName, start, end, {
  //         signal,
  //         basesPerSpan: end - start,
  //       })
  //       ob.pipe(
  //         mergeAll(),
  //         map(
  //           (r: {
  //             start: number
  //             end: number
  //             rest: string
  //             refName: string
  //             uniqueId: number
  //           }) => {
  //             const data = parser.parseLine(
  //               `${refName}\t${r.start}\t${r.end}\t${r.rest}`,
  //               {
  //                 uniqueId: r.uniqueId,
  //               },
  //             )

  //             const { blockCount, blockSizes, blockStarts, chromStarts } = data

  //             if (blockCount) {
  //               const starts = chromStarts || blockStarts || []
  //               const sizes = blockSizes
  //               const blocksOffset = r.start
  //               data.subfeatures = []

  //               for (let b = 0; b < blockCount; b += 1) {
  //                 const bmin = (starts[b] || 0) + blocksOffset
  //                 const bmax = bmin + (sizes[b] || 0)
  //                 data.subfeatures.push({
  //                   uniqueId: `${r.uniqueId}-${b}`,
  //                   start: bmin,
  //                   end: bmax,
  //                   type: 'block',
  //                 })
  //               }
  //             }
  //             const f = new SimpleFeature({
  //               id: r.uniqueId,
  //               data: {
  //                 ...data,
  //                 start: r.start,
  //                 end: r.end,
  //                 refName,
  //               },
  //             })
  //             return f.get('thickStart') ? ucscProcessedTranscript(f) : f
  //           },
  //         ),
  //       ).subscribe(observer)
  //     } catch (e) {
  //       observer.error(e)
  //     }
  //   })
  // }

  public freeResources(): void {}
}
