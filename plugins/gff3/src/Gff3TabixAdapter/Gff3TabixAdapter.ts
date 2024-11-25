import { TabixIndexedFile } from '@gmod/tabix'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { parseStringSync } from 'gff-nostream'
import { featureData } from '../featureData'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'
import type { Observer } from 'rxjs'

interface LineFeature {
  start: number
  end: number
  lineHash: number
  fields: string[]
}

export default class Gff3TabixAdapter extends BaseFeatureDataAdapter {
  protected gff: TabixIndexedFile

  protected dontRedispatch: string[]

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const gffGzLocation = readConfObject(config, 'gffGzLocation')
    const indexType = readConfObject(config, ['index', 'indexType'])
    const location = readConfObject(config, ['index', 'location'])
    const dontRedispatch = readConfObject(config, 'dontRedispatch')

    this.dontRedispatch = dontRedispatch || ['chromosome', 'contig', 'region']
    this.gff = new TabixIndexedFile({
      filehandle: openLocation(gffGzLocation, this.pluginManager),
      csiFilehandle:
        indexType === 'CSI'
          ? openLocation(location, this.pluginManager)
          : undefined,
      tbiFilehandle:
        indexType !== 'CSI'
          ? openLocation(location, this.pluginManager)
          : undefined,
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

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const metadata = await this.gff.getMetadata()
      await this.getFeaturesHelper(query, opts, metadata, observer, true)
    }, opts.stopToken)
  }

  private async getFeaturesHelper(
    query: Region,
    opts: BaseOptions,
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
        (line, fileOffset) => {
          lines.push(this.parseLine(metadata.columnNumbers, line, fileOffset))
        },
      )
      if (allowRedispatch && lines.length) {
        let minStart = Number.POSITIVE_INFINITY
        let maxEnd = Number.NEGATIVE_INFINITY
        for (const line of lines) {
          const featureType = line.fields[2]!
          // only expand redispatch range if feature is not a "dontRedispatch"
          // type skips large regions like chromosome,region
          if (!this.dontRedispatch.includes(featureType)) {
            const start = line.start - 1 // gff is 1-based
            if (start < minStart) {
              minStart = start
            }
            if (line.end > maxEnd) {
              maxEnd = line.end
            }
          }
        }
        if (maxEnd > query.end || minStart < query.start) {
          // make a new feature callback to only return top-level features
          // in the original query range
          await this.getFeaturesHelper(
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
        .map(lineRecord => {
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

      for (const featureLocs of parseStringSync(gff3)) {
        for (const featureLoc of featureLocs) {
          const f = new SimpleFeature({
            data: featureData(featureLoc),
            id: `${this.id}-offset-${featureLoc.attributes?._lineHash?.[0]}`,
          })
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
        }
      }
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
      start: +fields[columnNumbers.start - 1]!,
      end: +fields[columnNumbers.end - 1]!,
      lineHash: fileOffset,
      fields,
    }
  }

  public freeResources(/* { region } */) {}
}
