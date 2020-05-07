/* eslint-disable @typescript-eslint/no-explicit-any */
import BED from '@gmod/bed'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/util/types/mst'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { ucscProcessedTranscript } from '../util'
import MyConfigSchema from './configSchema'

export default class BedTabixAdapter extends BaseFeatureDataAdapter {
  private parser: any

  protected bed: TabixIndexedFile

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const bedGzLocation = readConfObject(
      config,
      'bedGzLocation',
    ) as IFileLocation
    const index = readConfObject(config, 'index') as {
      indexType?: string
      location: IFileLocation
    }
    const autoSql = readConfObject(config, 'autoSql') as string
    const { location, indexType } = index

    this.bed = new TabixIndexedFile({
      filehandle: openLocation(bedGzLocation),
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      tbiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })

    this.parser = new BED({ autoSql })
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
          const refName = l[0]
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
          delete data.chrom
          delete data.chromStart
          delete data.chromEnd
          const f = new SimpleFeature({
            ...data,
            start,
            end,
            refName,
          })
          const r = f.get('thickStart') ? ucscProcessedTranscript(f) : f
          observer.next(r)
        },
        signal: opts.signal,
      })
      observer.complete()
    })
  }

  public freeResources(): void {}
}
