import { hasIdAttribute, parseRecordsLazy } from '@gmod/gff-nostream'
import { TabixIndexedFile } from '@gmod/tabix'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus } from '@jbrowse/core/util'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { readTabixLinesRedispatched } from '@jbrowse/core/util/tabix'

import { Gff3Feature } from '../Gff3Feature.ts'
import { cutAtOrigin, sequenceLengths } from '../originSpanning.ts'

import type { Gff3TabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { TabixLine } from '@jbrowse/core/util/tabix'
import type { Region } from '@jbrowse/core/util/types'

export default class Gff3TabixAdapter extends BaseFeatureDataAdapter<Gff3TabixAdapterConfig> {
  // set once the file is open, for dataAdapterCache's eviction to clear
  private file?: TabixIndexedFile

  freeResources() {
    this.file?.clearChunkCache()
  }

  private configure = cachedSetup({
    label: 'Downloading index',
    setup: async (opts, onProgress) => {
      const gff = new TabixIndexedFile({
        filehandle: openLocation(
          this.getConf('gffGzLocation'),
          this.pluginManager,
        ),
        ...openTabixIndexFilehandle(
          this.getConf(['index', 'location']),
          this.getConf(['index', 'indexType']),
          this.pluginManager,
        ),
        chunkCacheBudget: decompressedBytesBudget,
      })
      this.file = gff
      // the index is a whole-file read, so its byte ticks turn the
      // "Downloading index" label into a determinate bar
      await gff.getReferenceSequenceNames({ onProgress, signal: opts.signal })
      return {
        gff,
        dontRedispatchSet: new Set(this.getConf('dontRedispatch')),
      }
    },
  })

  // the header read is sized from the index, so it can start only once the
  // index is in; the region read needs the same index and nothing else, so
  // getFeatures runs the two together
  private lengths = cachedSetup({
    setup: async opts => {
      const { gff } = await this.configure(opts)
      return sequenceLengths(await gff.getHeader(opts))
    },
  })

  public async getRefNames(opts: BaseOptions = {}) {
    const { gff } = await this.configure(opts)
    return downloadStatus(
      'Downloading index',
      opts.statusCallback,
      onProgress => gff.getReferenceSequenceNames({ ...opts, onProgress }),
    )
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { gff } = await this.configure(opts)
    return gff.getHeader(opts)
  }

  // Index-only compressed-byte estimate (no feature download), used by the
  // feature-fetch RPC to short-circuit an over-budget region before pulling
  // every line — see executeRenderFeatureData.
  public async getRegionByteSize(regions: Region[], opts: BaseOptions = {}) {
    const { gff } = await this.configure(opts)
    return gff.bytesForRegions(regions, opts)
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { gff, dontRedispatchSet } = await this.configure(opts)
        // The bound exists to reach a record's children, so what disqualifies a
        // record is having none. `ID` answers that exactly — nothing can name a
        // parent that has no name — and @gmod/gff-nostream decides it with the scan
        // its linker uses, so a record the tree would attach children to is
        // never one the bound leaves out. `dontRedispatch` can only approximate
        // the same question by type: every NCBI `GCF_*_genomic.gff.gz` opens
        // each reference with a chromosome-long `match` record no list named,
        // and none of them has an `ID`. The list covers what `ID` cannot see: a
        // record carrying an `ID` that nothing references, which hosted hg19
        // RefSeq's chromosome-long `region` is.
        const canHaveChildren = (line: TabixLine) =>
          hasIdAttribute(line.line) && !dontRedispatchSet.has(line.type)
        const read = (region: Region) =>
          readTabixLinesRedispatched(
            gff,
            region,
            // A caller reading only top-level features is owed nothing by the
            // flanks and pays for them anyway: they complete SUBFEATURE lists,
            // and a top-level feature overlapping the query is in the query's
            // own read already, since tabix returns every overlapping line and
            // a child is contained in its parent. On an NCBI
            // `GCF_*_genomic.gff.gz`, whose chromosome-long `match` widens the
            // bound at every window, that is 193,008 lines parsed to keep 3
            // features — 2734 ms against 8 ms.
            opts.topLevelOnly ? () => false : canHaveChildren,
            opts,
          )
        // a feature crossing a circular sequence's origin is indexed from its
        // start near the end, so a query short of the end reads the last base
        // too, for the part such a feature carries past the origin. That read
        // needs the length from the header, so it starts when the header
        // arrives and the query's own read does not wait for it.
        const tailRead = this.lengths(opts).then(async lengths => {
          const length = lengths.get(query.refName)
          return {
            length,
            lines:
              length !== undefined && query.end < length
                ? await read({ ...query, start: length - 1, end: length })
                : [],
          }
        })
        // the byte offset stays on our own record and is used purely to mint
        // a stable id, so it never pollutes the feature's data
        const [lines, tail] = await Promise.all([read(query), tailRead])
        const candidates = [lines, tail.lines].flatMap(group =>
          parseRecordsLazy(group).map(({ feature, record }) => ({
            feature,
            uniqueId: `${this.id}-offset-${record.offset}`,
          })),
        )
        for (const { feature, uniqueId } of cutAtOrigin(
          candidates,
          query,
          tail.length,
        )) {
          observer.next(new Gff3Feature(feature, uniqueId))
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }
}
