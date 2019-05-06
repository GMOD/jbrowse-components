import { mergeAll, map } from 'rxjs/operators'
import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'

import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import BaseAdapter, {
  Region,
  BaseOptions,
} from '@gmod/jbrowse-core/BaseAdapter'
import { Observable } from 'rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

export default class BigBedAdapter extends BaseAdapter {
  private bigbed: any

  private parser: any

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: { bigBedLocation: string }) {
    super(config)
    this.bigbed = new BigBed({
      filehandle: openLocation(config.bigBedLocation),
    })

    this.parser = this.bigbed
      .getHeader()
      .then(
        (header: { autoSql: string }) => new BED({ autoSql: header.autoSql }),
      )
  }

  public async getRefNames() {
    const header = await this.bigbed.getHeader()
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number) {
    return ((await this.bigbed.getHeader()).refsByNumber[refId] || {}).name
  }

  /**
   * @return promise for the totalSummary element from the bigbed's header
   */
  public async getGlobalStats() {
    const header = await this.bigbed.getHeader()
    return header.totalSummary
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @param abortSignal an abortSignal
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  // @ts-ignore the observable from bbi-js is somehow confusing typescript with jbrowse-components version
  public getFeatures(
    region: Region,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    const { refName, start, end } = region
    const { signal } = opts
    // @ts-ignore
    return ObservableCreate(async (observer: Observer<Feature>) => {
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
            rest: string
            refName: string
            uniqueId: number
          }) => {
            const data = regularizeFeat(
              parser.parseLine(`${refName}\t${r.start}\t${r.end}\t${r.rest}`, {
                uniqueId: r.uniqueId,
              }),
            )
            return new SimpleFeature({ data })
          },
        ),
      ).subscribe(observer)
    })
  }
}

/*
 * regularizes a feature by modifying the {chrom,chromStart,chromEnd} to {refName,start,end}
 * @params featureData a feature to regularize
 * @return a regularized feature
 */
function regularizeFeat(featureData: {
  chrom: string
  chromStart: number
  chromEnd: number
}) {
  const {
    chrom: refName,
    chromStart: start,
    chromEnd: end,
    ...rest
  } = featureData
  return { ...rest, refName, start, end }
}
