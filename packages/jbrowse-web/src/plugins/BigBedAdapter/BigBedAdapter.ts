import { mergeAll, map } from 'rxjs/operators'
import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'

import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { Observable, Observer } from 'rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

interface BEDFeature {
  chromStart: number
  chromEnd: number
  chrom: string
}
interface RegularizedFeature {
  refName: string
  start: number
  end: number
}
interface Parser {
  parseLine: (line: string, opts: { uniqueId: string | number }) => BEDFeature
}

export default class BigBedAdapter extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private bigbed: any

  private parser: Promise<Parser>

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: { bigBedLocation: string }) {
    super()
    this.bigbed = new BigBed({
      filehandle: openLocation(config.bigBedLocation),
    })

    this.parser = this.bigbed
      .getHeader()
      .then(
        (header: { autoSql: string }): Promise<Parser> =>
          new BED({ autoSql: header.autoSql }),
      )
  }

  public async getRefNames(): Promise<string[]> {
    const header = await this.bigbed.getHeader()
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number): Promise<string> {
    return ((await this.bigbed.getHeader()).refsByNumber[refId] || {}).name
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @param abortSignal an abortSignal
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(
    region: IRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    const { refName, start, end } = region
    const { signal } = opts
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

  public freeResources(): void {}
}

/*
 * regularizes a feature by modifying the {chrom,chromStart,chromEnd} to {refName,start,end}
 * @params featureData a feature to regularize
 * @return a regularized feature
 */
function regularizeFeat(featureData: BEDFeature): RegularizedFeature {
  const {
    chrom: refName,
    chromStart: start,
    chromEnd: end,
    ...rest
  } = featureData
  return { ...rest, refName, start, end }
}
