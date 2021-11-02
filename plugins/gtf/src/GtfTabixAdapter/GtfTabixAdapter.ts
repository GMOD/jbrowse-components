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
import { Observer, Observable } from 'rxjs'
import gtf from '@gmod/gtf'

import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import MyConfigSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { FeatureLoc, featureData } from '../util'

interface LineFeature {
  start: number
  end: number
  lineHash: number
  fields: string[]
}

export default class extends BaseFeatureDataAdapter {
  protected gtfFile: TabixIndexedFile
  protected dontRedispatch: string[]

  public constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config)
    const gtfGzLocation = readConfObject(config, 'gtfGzLocation')
    const indexType = readConfObject(config, ['index', 'indexType'])
    const location = readConfObject(config, ['index', 'location'])
    const dontRedispatch = readConfObject(config, 'dontRedispatch')

    this.dontRedispatch = dontRedispatch || ['chromosome', 'contig', 'region']

    this.gtfFile = new TabixIndexedFile({
      filehandle: openLocation(gtfGzLocation, this.pluginManager),
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      tbiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
      renameRefSeqs: (n: string) => n,
    })
  }
  public async getRefNames(opts: BaseOptions = {}) {
    return this.gtfFile.getReferenceSequenceNames(opts)
  }

  public async getHeader() {
    return this.gtfFile.getHeader()
  }

  public getFeatures(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    return ObservableCreate<Feature>(async observer => {
      const metadata = await this.gtfFile.getMetadata()
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

      await this.gtfFile.getLines(
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

      const gtfLines = lines
        .map((lineRecord: LineFeature) => {
          if (lineRecord.fields[8] && lineRecord.fields[8] !== '.') {
            if (!lineRecord.fields[8].includes('_lineHash')) {
              lineRecord.fields[8] += ` _lineHash ${lineRecord.lineHash};`
            }
          } else {
            lineRecord.fields[8] = `_lineHash ${lineRecord.lineHash};`
          }
          return lineRecord.fields.join('\t')
        })
        .join('\n')

      const features = gtf.parseStringSync(gtfLines, {
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
          data: featureData(featureLoc),
          id: `${this.id}-offset-${featureLoc.attributes._lineHash[0]}`,
        }),
    )
  }

  public freeResources(/* { region } */) {}
}
