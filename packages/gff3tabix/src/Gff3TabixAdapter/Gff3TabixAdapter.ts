import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import gff from '@gmod/gff'
import { GenericFilehandle } from 'generic-filehandle'
import { Observer } from 'rxjs'

type Strand = '+' | '-' | '.' | '?'
interface FeatureLoc {
  start: number
  end: number
  strand: Strand
  seq_id: string
  child_features: any[]
  data: any
  derived_features: any
  attributes: { [key: string]: any }
}

interface LineFeature {
  start: number
  end: number
  lineHash: number
  fields: string[]
}
export default class extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected gff: any

  protected dontRedispatch: string[]

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    gffGzLocation: IFileLocation
    index: {
      index: string
      location: IFileLocation
    }
    dontRedispatch: string[]
  }) {
    super()
    const {
      gffGzLocation,
      index: { location: indexLocation, index: indexType },
      dontRedispatch,
    } = config
    console.log(config)
    const gffGzOpts: {
      filehandle: GenericFilehandle
      tbiFilehandle?: GenericFilehandle
      csiFilehandle?: GenericFilehandle
      chunkCacheSize?: number
    } = {
      filehandle: openLocation(gffGzLocation),
      chunkCacheSize: 50 * 2 ** 20,
    }

    const indexFile = openLocation(indexLocation)
    if (indexType === 'CSI') {
      gffGzOpts.csiFilehandle = indexFile
    } else {
      gffGzOpts.tbiFilehandle = indexFile
    }
    this.dontRedispatch = dontRedispatch
    this.gff = new TabixIndexedFile(gffGzOpts)
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.gff.getReferenceSequenceNames(opts)
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(query: INoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async (observer: Observer<Feature>) => {
      const metadata = await this.gff.getMetadata()
      await this.getFeaturesHelper(
        query,
        opts,
        metadata,
        observer,
        (f: Feature) => observer.next(f),
      )
    })
  }

  private async getFeaturesHelper(
    query: INoAssemblyRegion,
    opts: BaseOptions = {},
    metadata: any,
    observer: any,
    callback: Function,
  ) {
    const lines: LineFeature[] = []

    await this.gff.getLines(query.refName, query.start, query.end, {
      lineCallback: (line: string, fileOffset: number) => {
        lines.push(this.parseLine(metadata.columnNumbers, line, fileOffset))
      },
      signal: opts.signal,
    })
    if (lines.length) {
      let minStart = Infinity
      let maxEnd = -Infinity
      lines.forEach(line => {
        const featureType = line.fields[2]
        // only expand redispatch range if the feature is not in dontRedispatch,
        // and is a top-level feature
        if (
          !this.dontRedispatch.includes(featureType)
          // this._isTopLevelFeatureType(featureType)
        ) {
          const start = line.start - 1 // gff is 1-based
          if (start < minStart) minStart = start
          if (line.end > maxEnd) maxEnd = line.end
        }
      })
      if (maxEnd > query.end || minStart < query.start) {
        // console.log(`redispatching ${query.start}-${query.end} => ${minStart}-${maxEnd}`)
        const newQuery = { ...query, start: minStart, end: maxEnd }
        // make a new feature callback to only return top-level features
        // in the original query range
        const newFeatureCallback = (feature: any) => {
          if (
            feature.get('start') < query.end &&
            feature.get('end') > query.start
          ) {
            observer.next(feature)
          }
        }
        await this.getFeaturesHelper(
          newQuery,
          opts,
          metadata,
          observer,
          newFeatureCallback,
        )
      }
    }

    const gff3 = lines
      .map((lineRecord: LineFeature) => {
        if (lineRecord.fields[8] && lineRecord.fields[8] !== '.') {
          if (!lineRecord.fields[8].includes('_lineHash'))
            lineRecord.fields[8] += `;_lineHash=${lineRecord.lineHash}`
        } else {
          lineRecord.fields[8] = `_lineHash=${lineRecord.lineHash}`
        }
        return lineRecord.fields.join('\t')
      })
      .join('\n')

    const features = gff.parseStringSync(gff3, {
      parseFeatures: true,
      parseComments: false,
      parseDirectives: false,
      parseSequences: false,
    })

    features.forEach((featureLocs: any) =>
      this.formatFeatures(featureLocs).forEach(f => callback(f)),
    )
    observer.complete()
  }

  private parseLine(
    columnNumbers: { start: number; end: number },
    line: string,
    fileOffset: number,
  ) {
    const fields = line.split('\t')

    // note: index column numbers are 1-based
    return {
      start: +fields[columnNumbers.start - 1],
      end: +fields[columnNumbers.end - 1],
      lineHash: fileOffset,
      fields,
    }
  }

  private formatFeatures(featureLocs: FeatureLoc[]) {
    const features: Feature[] = []
    featureLocs.forEach((featureLoc, locIndex) => {
      const ids = featureLoc.attributes.ID || [
        // eslint-disable-next-line no-underscore-dangle
        `offset-${featureLoc.attributes._lineHash[0]}`,
      ]
      ids.forEach((id: string, idIndex: number) => {
        const f = new SimpleFeature({
          data: this.featureData(featureLoc),
          id: idIndex === 0 ? id : `${id}-${idIndex + 1}`,
        })
        features.push(f)
      })
    })
    return features
  }

  private featureData(data: FeatureLoc) {
    const f = { ...data } as any
    delete f.child_features
    delete f.data
    delete f.derived_features
    f.start -= 1 // convert to interbase
    f.strand = { '+': 1, '-': -1, '.': 0, '?': undefined }[f.strand as Strand] // convert strand
    const defaultFields = [
      'start',
      'end',
      'seq_id',
      'score',
      'type',
      'source',
      'phase',
      'strand',
    ]
    Object.keys(data.attributes).forEach(a => {
      let b = a.toLowerCase()
      if (defaultFields.includes(b)) b += '2' // reproduce behavior of NCList
      f[b] = data.attributes[a]
      if (f[b].length == 1) {
        // eslint-disable-next-line prefer-destructuring
        f[b] = f[b][0]
      }
    })
    // eslint-disable-next-line no-underscore-dangle
    f.uniqueID = `offset-${f._linehash}`
    f.refName = f.seq_id
    // eslint-disable-next-line no-underscore-dangle
    delete f._linehash
    delete f.attributes
    // the SimpleFeature constructor takes care of recursively inflating subfeatures
    if (data.child_features && data.child_features.length) {
      f.subfeatures = data.child_features
        .map(childLocs =>
          childLocs.map((childLoc: any) => this.featureData(childLoc)),
        )
        .flat()
    }

    return f
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
