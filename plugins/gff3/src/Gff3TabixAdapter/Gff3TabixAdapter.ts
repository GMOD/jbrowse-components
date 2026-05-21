import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { extractType, parseRecordsJBrowse } from 'gff-nostream'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'
import type { LineRecord } from 'gff-nostream'
import type { Observer } from 'rxjs'

export default class Gff3TabixAdapter extends BaseFeatureDataAdapter {
  private configured?: Promise<{
    gff: TabixIndexedFile
    dontRedispatchSet: Set<string>
    header: string
  }>

  private buildConfigured() {
    const gffGzLocation = this.getConf('gffGzLocation')
    const indexType = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const dontRedispatch = this.getConf('dontRedispatch') as string[]
    const gff = new TabixIndexedFile({
      filehandle: openLocation(gffGzLocation, this.pluginManager),
      csiFilehandle:
        indexType === 'CSI' ? openLocation(loc, this.pluginManager) : undefined,
      tbiFilehandle:
        indexType !== 'CSI' ? openLocation(loc, this.pluginManager) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
    return gff.getHeader().then(header => ({
      gff,
      dontRedispatchSet: new Set(dontRedispatch),
      header,
    }))
  }

  protected configureOnce() {
    this.configured ??= this.buildConfigured().catch((e: unknown) => {
      this.configured = undefined
      throw e
    })
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    return updateStatus('Downloading index', opts?.statusCallback, () =>
      this.configureOnce(),
    )
  }
  public async getRefNames(opts: BaseOptions = {}) {
    const { gff } = await this.configure(opts)
    return gff.getReferenceSequenceNames(opts)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.configure(opts)
    return header
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      await this.configure(opts)
      await this.getFeaturesHelper(query, opts, observer, true)
    }, opts.stopToken)
  }

  private async getFeaturesHelper(
    query: Region,
    opts: BaseOptions,
    observer: Observer<Feature>,
    allowRedispatch: boolean,
    originalQuery = query,
  ) {
    try {
      const { gff, dontRedispatchSet } = await this.configureOnce()
      const lines: LineRecord[] = []

      await updateStatus('Downloading features', opts.statusCallback, () =>
        gff.getLines(
          query.refName,
          query.start,
          query.end,
          (line, fileOffset, start, end) => {
            lines.push({
              line,
              lineHash: fileOffset,
              start,
              end,
              hasEscapes: line.includes('%'),
              type: extractType(line),
            })
          },
        ),
      )

      if (allowRedispatch && lines.length) {
        let minStart = Number.POSITIVE_INFINITY
        let maxEnd = Number.NEGATIVE_INFINITY
        for (const rec of lines) {
          // only expand redispatch range if feature is not a "dontRedispatch"
          // type skips large regions like chromosome,region
          if (!dontRedispatchSet.has(rec.type)) {
            const start = rec.start - 1 // gff is 1-based
            if (start < minStart) {
              minStart = start
            }
            if (rec.end > maxEnd) {
              maxEnd = rec.end
            }
          }
        }
        if (maxEnd > query.end || minStart < query.start) {
          // make a new feature callback to only return top-level features
          // in the original query range
          await this.getFeaturesHelper(
            { ...query, start: minStart, end: maxEnd },
            opts,
            observer,
            false,
            query,
          )
          return
        }
      }

      for (const feature of parseRecordsJBrowse(lines)) {
        if (
          doesIntersect2(
            feature.start,
            feature.end,
            originalQuery.start,
            originalQuery.end,
          )
        ) {
          observer.next(
            new SimpleFeature({
              data: feature,
              id: `${this.id}-offset-${feature._lineHash}`,
            }),
          )
        }
      }
      observer.complete()
    } catch (e) {
      observer.error(e)
    }
  }
}
