/* eslint-disable no-underscore-dangle */
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { NoAssemblyRegion, Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { Observer, Observable } from 'rxjs'

import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import MyConfigSchema from './configSchema'

type Strand = '+' | '-' | '.' | '?'
interface FeatureLoc {
  [key: string]: unknown
  seq_name: string
  source: string
  feature: string
  start: number
  end: number
  score: number
  strand: Strand
  frame: number
  attributes: { [key: string]: unknown[] }
}

interface LineFeature {
  start: number
  end: number
  lineHash: number
  fields: string[]
}

export default class extends BaseFeatureDataAdapter {
  protected gtf: TabixIndexedFile
  protected dontRedispatch: string[]

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const gtfGzLocation = readConfObject(config, 'gtfGzLocation')
    const indexType = readConfObject(config, ['index', 'indexType'])
    const location = readConfObject(config, ['index', 'location'])
    const dontRedispatch = readConfObject(config, 'dontRedispatch')

    this.dontRedispatch = dontRedispatch || ['chromosome', 'contig', 'region']

    this.gtf = new TabixIndexedFile({
      filehandle: openLocation(gtfGzLocation),
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      tbiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
      renameRefSeqs: (n: string) => n,
    })
  }
  public async getRefNames(opts: BaseOptions = {}) {
    return this.gtf.getReferenceSequenceNames(opts)
  }

  public async getHeader() {
    return this.gtf.getHeader()
  }

  public getFeatures(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    return ObservableCreate<Feature>(async observer => {
      const metadata = await this.gtf.getMetadata()
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

      await this.gtf.getLines(
        query.refName,
        query.start,
        query.end,
        (line: string, fileOffset: number) => {
          lines.push(this.parseLine(metadata.columnNumbers, line, fileOffset))
        },
      )
      if(allowRedispatch && lines.length) {
        let minStart = Infinity
        let maxEnd = -Infinity

        lines.forEach(line => {
          const featureType = line.fields[2]

          if (!this.dontRedispatch.includes(featureType)) {
            const start = line.start - 1
            if (start < minStart) {
              minStart = start
            }
            if(line.end > maxEnd) {
              maxEnd = line.end
            }
          }
        })
        if (maxEnd > query.end || minStart < query.start) {
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

      const gtf = lines
      .map((lineRecord: LineFeature) => {
        if(lineRecord.fields[8] && lineRecord.fields[8] !== '.') {
          if(!lineRecord.fields[8].includes('_lineHash')) {
            lineRecord.fields[8] += `;_lineHash =${lineRecord.lineHash}`
          }
        } else {
          lineRecord.fields[8] = `_lineHash=${lineRecord.lineHash}`
        }
        return lineRecord.fields.join('\t')
      })
      .join('\n')

      const features = this.gtfParseStringSync(gtf) as FeatureLoc[][]

      // features.forEach(featureLocs => 
      //   this.formatFeatures(featureLocs).forEach(f => {
      //     if ( /* does intersect */)
      //   }))
    } catch (e) {
      observer.error(e)
    }
  }

  private formatFeatures(featureLocs: FeatureLoc[]) {
    
  }
  private featureData(data: FeatureLoc) {}

  private parseLine(
    columnNumbers: { start: number; end: number },
    line: string,
    fileOffset: number,
  ) {
    const fields = line.split('\t')

    return {
      start: +fields[columnNumbers.start - 1],
      end: +fields[columnNumbers.end - 1],
      lineHash: fileOffset,
      fields,
    }
  }

  private gtfParseStringSync(str: string) {
    if (!str) {
      return {}
    }
    const [
      seq_name,
      source,
      feature,
      start,
      end,
      score,
      strand,
      frame,
      attributes,
    ] = str.split('\t')

    const attrs = attributes.split(';')
    const items = {
      seq_name: seq_name,
      source: source,
      feature: feature,
      start: start,
      end: end,
      score: score,
      strand: strand,
      frame: frame,
      attributes: attrs,
    }

    return items
  }

  public freeResources(/* { region } */): void {}
}
