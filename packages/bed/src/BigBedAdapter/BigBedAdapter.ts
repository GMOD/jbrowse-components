/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'
import BaseAdapter, {
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { map, mergeAll } from 'rxjs/operators'

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
interface Parser {
  parseLine: (line: string, opts: { uniqueId: string | number }) => BEDFeature
}

export default class extends BaseAdapter {
  private bigbed: BigBed

  private parser: Promise<Parser>

  public constructor(config: { bigBedLocation: IFileLocation }) {
    super()
    this.bigbed = new BigBed({
      filehandle: openLocation(config.bigBedLocation),
    })

    this.parser = this.bigbed
      .getHeader()
      .then(({ autoSql }: { autoSql: string }) => new BED({ autoSql }))
  }

  public async getRefNames() {
    return Object.keys((await this.bigbed.getHeader()).refsByName)
  }

  public async refIdToName(refId: number) {
    return ((await this.bigbed.getHeader()).refsByNumber[refId] || {}).name
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @param abortSignal an abortSignal
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(region: IRegion, opts: BaseOptions = {}) {
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
              const f = new SimpleFeature({
                id: r.uniqueId,
                data: {
                  ...data,
                  start: r.start,
                  end: r.end,
                  refName,
                },
              })
              return f.get('thickStart') ? ucscProcessedTranscript(f) : f
            },
          ),
        ).subscribe(observer)
      } catch (e) {
        observer.error(e)
      }
    })
  }

  public freeResources(): void {}
}

function ucscProcessedTranscript(feature: Feature) {
  const children = feature.children()
  // split the blocks into UTR, CDS, and exons
  const thickStart = feature.get('thickStart')
  const thickEnd = feature.get('thickEnd')

  if (!thickStart && !thickEnd) {
    return feature
  }

  const blocks: Feature[] = children
    ? children
        .filter(child => child.get('type') === 'block')
        .sort((a, b) => a.get('start') - b.get('start'))
    : []
  const newChildren: Record<string, any> = []
  blocks.forEach((block, index) => {
    const start = block.get('start')
    const end = block.get('end')
    if (thickStart >= end) {
      // left-side UTR
      const prime = feature.get('strand') > 0 ? 'five' : 'three'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
      })
    } else if (thickStart > start && thickStart < end && thickEnd >= end) {
      // UTR | CDS
      const prime = feature.get('strand') > 0 ? 'five' : 'three'
      newChildren.push(
        {
          type: `${prime}_prime_UTR`,
          start,
          end: thickStart,
        },
        {
          type: 'CDS',
          start: thickStart,
          end,
        },
      )
    } else if (thickStart <= start && thickEnd >= end) {
      // CDS
      newChildren.push({
        type: 'CDS',
        start,
        end,
      })
    } else if (thickStart > start && thickStart < end && thickEnd < end) {
      // UTR | CDS | UTR
      const leftPrime = feature.get('strand') > 0 ? 'five' : 'three'
      const rightPrime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push(
        {
          type: `${leftPrime}_prime_UTR`,
          start,
          end: thickStart,
        },
        {
          type: `CDS`,
          start: thickStart,
          end: thickEnd,
        },
        {
          type: `${rightPrime}_prime_UTR`,
          start: thickEnd,
          end,
        },
      )
    } else if (thickStart <= start && thickEnd > start && thickEnd < end) {
      // CDS | UTR
      const prime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push(
        {
          type: `CDS`,
          start,
          end: thickEnd,
        },
        {
          type: `${prime}_prime_UTR`,
          start: thickEnd,
          end,
        },
      )
    } else if (thickEnd <= start) {
      // right-side UTR
      const prime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
      })
    }
  })
  const newData: Record<string, any> = {}
  feature.tags().forEach(tag => {
    newData[tag] = feature.get(tag)
  })
  newData.subfeatures = newChildren
  newData.type = 'mRNA'
  newData.uniqueId = feature.id()
  delete newData.chromStarts
  delete newData.chromStart
  delete newData.chromEnd
  delete newData.chrom
  delete newData.blockSizes
  delete newData.blockCount
  delete newData.thickStart
  delete newData.thickEnd
  const newFeature = new SimpleFeature({
    data: newData,
    id: feature.id(),
  })
  return newFeature
}
