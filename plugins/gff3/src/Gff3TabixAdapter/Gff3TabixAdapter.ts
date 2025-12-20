import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { parseRecordsSync } from 'gff-nostream'

import { featureData } from '../featureData'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
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
      const lines: LineFeature[] = []

      const { dontRedispatchSet, gff } = await this.configure(opts)
      const { start: startCol, end: endCol } = metadata.columnNumbers
      await updateStatus('Downloading features', statusCallback, () =>
        gff.getLines(
          query.refName,
          query.start,
          query.end,
          (line, fileOffset) => {
            const fields = line.split('\t')
            lines.push({
              // note: index column numbers are 1-based
              start: +fields[startCol - 1]!,
              end: +fields[endCol - 1]!,
              lineHash: fileOffset,
              fields,
            })
          },
        ),
      )

      if (allowRedispatch && lines.length) {
        let minStart = Number.POSITIVE_INFINITY
        let maxEnd = Number.NEGATIVE_INFINITY
        for (const line of lines) {
          const featureType = line.fields[2]!
          // only expand redispatch range if feature is not a "dontRedispatch"
          // type skips large regions like chromosome,region
          if (!dontRedispatchSet.has(featureType)) {
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

      for (const featureLocs of parseRecordsSync(lines)) {
        for (const featureLoc of featureLocs) {
          // Check intersection before creating SimpleFeature to avoid
          // unnecessary allocations GFF3 coordinates are 1-based, so subtract
          // 1 from start for 0-based
          const start = featureLoc.start! - 1
          const end = featureLoc.end!
          if (
            doesIntersect2(start, end, originalQuery.start, originalQuery.end)
          ) {
            observer.next(
              new SimpleFeature({
                data: featureData(featureLoc),
                id: `${this.id}-offset-${featureLoc.attributes?._lineHash?.[0]}`,
              }),
            )
          }
        }
      }
      observer.complete()
    } catch (e) {
      observer.error(e)
    }
  }
}
