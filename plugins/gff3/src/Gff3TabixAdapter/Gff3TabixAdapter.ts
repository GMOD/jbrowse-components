/* eslint-disable no-underscore-dangle */
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import gff from '@gmod/gff'
import { Observer } from 'rxjs'

import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import MyConfigSchema from './configSchema'

type Strand = '+' | '-' | '.' | '?'
interface FeatureLoc {
  [key: string]: unknown
  start: number
  end: number
  strand: Strand
  seq_id: string
  child_features: FeatureLoc[][]
  data: unknown
  derived_features: unknown
  attributes: { [key: string]: unknown[] }
}

interface LineFeature {
  start: number
  end: number
  lineHash: number
  fields: string[]
}

export default class extends BaseFeatureDataAdapter {
  protected gff: TabixIndexedFile

  protected dontRedispatch: string[]

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const gffGzLocation = readConfObject(config, 'gffGzLocation')
    const indexType = readConfObject(config, ['index', 'indexType'])
    const location = readConfObject(config, ['index', 'location'])
    const dontRedispatch = readConfObject(config, 'dontRedispatch')

    this.dontRedispatch = dontRedispatch || ['chromosome', 'contig', 'region']
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

  public async getHeader() {
    return this.gff.getHeader()
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const metadata = await this.gff.getMetadata()
      this.getFeaturesHelper(query, opts, metadata, observer, true)
    }, opts.signal)
  }

  private async getFeaturesHelper(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
    metadata: { columnNumbers: { start: number; end: number } },
    observer: Observer<Feature>,
    allowRedispatch: boolean,
    originalQuery = query,
  ) {
    try {
      const lines: LineFeature[] = []

      await this.gff.getLines(
        query.refName,
        query.start,
        query.end,
        (line: string, fileOffset: number) => {
          lines.push(this.parseLine(metadata.columnNumbers, line, fileOffset))
        },
      )
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
          // console.log(
          //   `redispatching ${query.start}-${query.end} => ${minStart}-${maxEnd}`,
          // )
          // make a new feature callback to only return top-level features
          // in the original query range

          this.getFeaturesHelper(
            { ...query, start: minStart, end: maxEnd },
            opts,
            metadata,
            observer,
            false,
            query,
          )
          return
        }
      }

      const gff3 = lines
        .map((lineRecord: LineFeature) => {
          if (lineRecord.fields[8] && lineRecord.fields[8] !== '.') {
            if (!lineRecord.fields[8].includes('_lineHash')) {
              lineRecord.fields[8] += `;_lineHash=${lineRecord.lineHash}`
            }
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
      }) as FeatureLoc[][]

      features.forEach(featureLocs =>
        this.formatFeatures(featureLocs).forEach(f => {
          if (
            doesIntersect2(
              f.get('start'),
              f.get('end'),
              originalQuery.start,
              originalQuery.end,
            )
          ) {
            observer.next(f)
          }
        }),
      )
      observer.complete()
    } catch (e) {
      observer.error(e)
    }
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
      featureLoc =>
        new SimpleFeature({
          data: this.featureData(featureLoc),
          id: `${this.id}-offset-${featureLoc.attributes._lineHash[0]}`,
        }),
    )
  }

  private featureData(data: FeatureLoc) {
    const f: Record<string, unknown> = { ...data }
    ;(f.start as number) -= 1 // convert to interbase
    f.strand = { '+': 1, '-': -1, '.': 0, '?': undefined }[data.strand] // convert strand
    f.phase = Number(data.phase)
    f.refName = data.seq_id
    if (data.score === null) {
      delete f.score
    }
    if (data.phase === null) {
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
        let attr = data.attributes[a]
        if (Array.isArray(attr) && attr.length === 1) {
          ;[attr] = attr
        }
        f[b] = attr
      }
    })
    f.refName = f.seq_id

    // the SimpleFeature constructor takes care of recursively inflating subfeatures
    if (data.child_features && data.child_features.length) {
      f.subfeatures = data.child_features
        .map(childLocs => childLocs.map(childLoc => this.featureData(childLoc)))
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

  public freeResources(/* { region } */) {}
}
