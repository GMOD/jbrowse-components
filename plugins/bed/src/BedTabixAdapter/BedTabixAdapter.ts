/* eslint-disable @typescript-eslint/no-explicit-any */
import BED from '@gmod/bed'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { FileLocation, Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import { ucscProcessedTranscript } from '../util'
import MyConfigSchema from './configSchema'

export default class BedTabixAdapter extends BaseFeatureDataAdapter {
  private parser: any

  protected bed: TabixIndexedFile

  protected columnNames: string[]

  protected scoreColumn: string

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const bedGzLocation = readConfObject(
      config,
      'bedGzLocation',
    ) as FileLocation
    const index = readConfObject(config, 'index') as {
      indexType?: string
      location: FileLocation
    }
    const autoSql = readConfObject(config, 'autoSql') as string
    const { location, indexType } = index

    this.bed = new TabixIndexedFile({
      filehandle: openLocation(bedGzLocation),
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      tbiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
    this.columnNames = readConfObject(config, 'columnNames')
    this.scoreColumn = readConfObject(config, 'scoreColumn')
    this.parser = new BED({ autoSql })
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.bed.getReferenceSequenceNames(opts)
  }

  async getHeader() {
    return this.bed.getHeader()
  }

  defaultParser(fields: string[], line: string) {
    return Object.fromEntries(line.split('\t').map((f, i) => [fields[i], f]))
  }

  async getNames() {
    if (this.columnNames.length) {
      return this.columnNames
    }
    const header = await this.bed.getHeader()
    const defs = header.split('\n').filter(f => !!f)
    const defline = defs[defs.length - 1]
    return defline && defline.includes('\t')
      ? defline
          .slice(1)
          .split('\t')
          .map(field => field.trim())
      : null
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const meta = await this.bed.getMetadata()
      const names = await this.getNames()
      await this.bed.getLines(query.refName, query.start, query.end, {
        lineCallback: (line: string, fileOffset: number) => {
          const l = line.split('\t')
          const refName = l[meta.columnNumbers.ref - 1]
          const start = +l[meta.columnNumbers.start - 1]
          const end =
            +l[meta.columnNumbers.end - 1] +
            (meta.columnNumbers.end === meta.columnNumbers.start ? 1 : 0)
          const uniqueId = `${this.id}-${fileOffset}`
          const data = names
            ? this.defaultParser(names, line)
            : this.parser.parseLine(line, { uniqueId })

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

          if (this.scoreColumn) {
            data.score = data[this.scoreColumn]
          }
          delete data.chrom
          delete data.chromStart
          delete data.chromEnd
          const f = new SimpleFeature({
            ...data,
            start,
            end,
            refName,
            uniqueId,
          })
          const r = f.get('thickStart') ? ucscProcessedTranscript(f) : f
          observer.next(r)
        },
        signal: opts.signal,
      })
      observer.complete()
    }, opts.signal)
  }

  public freeResources(): void {}
}
