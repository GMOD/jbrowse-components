/* eslint-disable no-underscore-dangle */
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import gff from '@gmod/gff'
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

interface Config {
  gffGzLocation: IFileLocation
  index: {
    index: string
    location: IFileLocation
  }
  dontRedispatch: string[]
}
export default class extends BaseAdapter {
  protected gff: TabixIndexedFile

  protected dontRedispatch: string[]

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: Config) {
    super()
    const { gffGzLocation, index, dontRedispatch } = config
    const { location, index: indexType } = index

    this.dontRedispatch = dontRedispatch || ['chromosome', 'region']
    this.gff = new TabixIndexedFile({
      filehandle: openLocation(gffGzLocation),
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      tbiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
      renameRefSeqs: (n: string) => n,
    })
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
      this.getFeaturesHelper(query, opts, metadata, observer, true)
    })
  }

  private async getFeaturesHelper(
    query: INoAssemblyRegion,
    opts: BaseOptions = {},
    metadata: { columnNumbers: { start: number; end: number } },
    observer: Observer<Feature>,
    allowRedispatch = false,
  ) {
    const lines: LineFeature[] = []

    await this.gff.getLines(query.refName, query.start, query.end, {
      lineCallback: (line: string, fileOffset: number) => {
        lines.push(this.parseLine(metadata.columnNumbers, line, fileOffset))
      },
      signal: opts.signal,
    })
    if (allowRedispatch && lines.length) {
      let minStart = Infinity
      let maxEnd = -Infinity
      lines.forEach(line => {
        const featureType = line.fields[2]
        // only expand redispatch range if feature is not a "dontRedispatch" type
        // skips large regions like chromosome,region
        if (!this.dontRedispatch.includes(featureType)) {
          const start = line.start - 1 // gff is 1-based
          if (start < minStart) {
            minStart = start
          }
          if (line.end > maxEnd) {
            maxEnd = line.end
          }
        }
      })
      if (maxEnd > query.end || minStart < query.start) {
        console.log(
          `redispatching ${query.start}-${query.end} => ${minStart}-${maxEnd}`,
        )
        // make a new feature callback to only return top-level features
        // in the original query range

        this.getFeaturesHelper(
          { ...query, start: minStart, end: maxEnd },
          opts,
          metadata,
          observer,
          false,
        )
        return
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
      this.formatFeatures(featureLocs).forEach(f => {
        if (
          doesIntersect2(f.get('start'), f.get('end'), query.start, query.end)
        ) {
          observer.next(f)
        }
      }),
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
    return featureLocs.map(
      (featureLoc, locIndex) =>
        new SimpleFeature({
          data: this.featureData(featureLoc),
          id: `offset-${featureLoc.attributes._lineHash[0]}`,
        }),
    )
  }

  private featureData(data: FeatureLoc) {
    const f = { ...data } as any

    f.start -= 1 // convert to interbase
    f.strand = { '+': 1, '-': -1, '.': 0, '?': undefined }[f.strand as Strand] // convert strand
    f.phase = +f.phase
    f.refName = f.seq_id
    if (f.score === null) {
      delete f.score
    }
    if (f.phase === null) {
      delete f.score
    }
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
      if (defaultFields.includes(b)) {
        // add "suffix" to tag name if it already exists
        // reproduces behavior of NCList
        b += '2'
      }
      if (data.attributes[a] !== null) {
        f[b] = data.attributes[a]
        if (f[b].length == 1) {
          // eslint-disable-next-line prefer-destructuring
          f[b] = f[b][0]
        }
      }
    })
    f.refName = f.seq_id

    // the SimpleFeature constructor takes care of recursively inflating subfeatures
    if (data.child_features && data.child_features.length) {
      f.subfeatures = data.child_features
        .map(childLocs =>
          childLocs.map((childLoc: any) => this.featureData(childLoc)),
        )
        .flat()
    }

    delete f.child_features
    delete f.data
    delete f.derived_features
    delete f._linehash
    delete f.attributes
    delete f.seq_id
    return f
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
