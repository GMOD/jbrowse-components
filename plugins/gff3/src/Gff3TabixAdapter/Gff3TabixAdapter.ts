import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { parseRecordsJBrowse } from 'gff-nostream'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'
import type { LineRecord } from 'gff-nostream'
import type { Observer } from 'rxjs'

export default class Gff3TabixAdapter extends BaseFeatureDataAdapter {
  private configured?: Promise<{
    gff: TabixIndexedFile
    dontRedispatchSet: Set<string>
  }>

  private async configurePre(_opts?: BaseOptions) {
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

    return {
      gff,
      dontRedispatchSet: new Set(dontRedispatch),
      header: await gff.getHeader(),
    }
  }

  protected async configurePre2() {
    if (!this.configured) {
      this.configured = this.configurePre().catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    }
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.configurePre2(),
    )
  }
  public async getRefNames(opts: BaseOptions = {}) {
    const { gff } = await this.configure(opts)
    return gff.getReferenceSequenceNames(opts)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { gff } = await this.configure(opts)
    return gff.getHeader()
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { gff } = await this.configure(opts)
      const metadata = await gff.getMetadata()
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
    const { statusCallback = () => {} } = opts
    try {
      const lines: (LineRecord & { type: string })[] = []

      const { dontRedispatchSet, gff } = await this.configure(opts)
      await updateStatus('Downloading features', statusCallback, () =>
        gff.getLines(
          query.refName,
          query.start,
          query.end,
          (line, fileOffset, start, end) => {
            // Extract type (column 3) without full split - find 2nd and 3rd tabs
            const t1 = line.indexOf('\t')
            const t2 = line.indexOf('\t', t1 + 1)
            const t3 = line.indexOf('\t', t2 + 1)
            const type = line.slice(t2 + 1, t3)

            lines.push({
              line,
              lineHash: fileOffset,
              start,
              end,
              hasEscapes: line.includes('%'),
              type,
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
            metadata,
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
              data: feature as unknown as Record<string, unknown>,
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
