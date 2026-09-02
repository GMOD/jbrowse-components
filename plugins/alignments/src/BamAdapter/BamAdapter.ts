import { BamFile, packReference } from '@gmod/bam'
import { numericCigarHasSkip } from '@jbrowse/cigar-utils'
import { downloadStatus, withProgress } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken,
  withStopTokenSignal,
} from '@jbrowse/core/util/stopToken'

import { BaseSamAdapter } from '../shared/BaseSamAdapter.ts'
import { seqFetchSpan } from '../shared/seqFetchSpan.ts'
import {
  filterReadFlag,
  filterSpliced,
  filterTagValue,
} from '../shared/util.ts'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature.ts'

import type { FilterBy } from '../shared/types.ts'
import type { BamAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export default class BamAdapter extends BaseSamAdapter<BamAdapterConfig> {
  protected configureResult?: { bam: BamFile<BamSlightlyLazyFeature> }

  /**
   * Whether a query on this file has ever turned up a read with no MD tag, and
   * so whether the next query should fetch reference bases speculatively rather
   * than waiting to find out.
   *
   * Sticky and never cleared, because it gates a PREFETCH rather than a
   * decision: `seqFetchSpan` still decides per query whether the result is
   * used, so the worst a stale `true` costs is one unused read. Clearing it on
   * a query whose reads all carried MD would make a file with a mixed tail flap
   * between prefetching and not.
   */
  private needsReference = false

  /**
   * The region's reference bases, or undefined if no sequence adapter is
   * configured (a ChromSizesAdapter assembly is legitimate and serves none).
   *
   * The whole region rather than the reads' span: this is called before the
   * records exist, and the region is the span's upper bound anyway since
   * `seqFetchSpan` clamps to it.
   */
  private async fetchRegionSeq(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions,
  ) {
    const sequenceAdapter = await this.getSequenceAdapter()
    return sequenceAdapter?.getSequence(
      {
        refName: region.originalRefName ?? region.refName,
        start: region.start,
        end: region.end,
      },
      // The opts every other read on this path already carries, and the only
      // one that was going without them. Without the stop token a pan that
      // lands mid-fetch still decodes and returns the whole region's residues
      // to a query nobody is waiting for; without the callback the reader sees
      // no phase at all for it.
      { stopToken: opts?.stopToken, statusCallback: opts?.statusCallback },
    )
  }

  protected configure() {
    if (!this.configureResult) {
      // #region nestedRead
      // a path array reaches into the nested `index` sub-schema; reading
      // `getConf('index').indexType` instead would bypass default resolution
      const csi = this.getConf(['index', 'indexType']) === 'CSI'
      const location = this.getConf(['index', 'location'])
      // #endregion
      this.configureResult = {
        bam: new BamFile({
          bamFilehandle: openLocation(
            this.getConf('bamLocation'),
            this.pluginManager,
          ),
          csiFilehandle: csi
            ? openLocation(location, this.pluginManager)
            : undefined,
          baiFilehandle: csi
            ? undefined
            : openLocation(location, this.pluginManager),
          recordClass: BamSlightlyLazyFeature,
          // maxCacheBytes is per file, and one BamFile is held per open track,
          // so its 1GB ceiling was multiplied by the track count with nothing
          // bounding the sum; see cacheBudgets
          cacheBudget: decompressedBytesBudget,
          // Inflate this file's BGZF blocks across a worker pool instead of on
          // this thread; measured 1.95x end to end on a 22-view pan/zoom over
          // 1000x long-read data, same records returned. Shared with the nine
          // tabix adapters — see bgzfWorkerPool for why it is one pool per JS
          // context, why the import inside it has to be dynamic, and why it
          // degrades to inflating in process rather than throwing.
          bgzfWorkerPool: this.getConf('useBgzfWorkerPool')
            ? sharedBgzfWorkerPool()
            : undefined,
        }),
      }
    }
    return this.configureResult
  }

  protected async readSamHeader(onProgress?: (n: number, t?: number) => void) {
    // BamFile.getHeaderPre parses the .bai/.csi before reading the header
    // block, so this one await covers the whole "Downloading index" phase
    const { bam } = this.configure()
    return bam.getHeader({ onProgress })
  }

  async getHeader(_opts?: BaseOptions) {
    const { bam } = this.configure()
    return bam.getHeaderText()
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy?: FilterBy
    },
  ) {
    // originalRefName is not read here — fetchRegionSeq resolves it, since the
    // reference read is the only consumer of the assembly-side name
    const { refName, start, end } = region
    const { stopToken, filterBy, statusCallback } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      await this.setup(opts)
      const { bam } = this.configure()
      checkStopToken(stopToken)

      // Started BEFORE the alignment fetch is awaited, so the two round trips
      // overlap. Only once this file is known to hold MD-less reads — see
      // `needsReference` — and deliberately not awaited here; the await is
      // below, after the records land and `span` says whether it is wanted.
      //
      const prefetched = this.needsReference
        ? this.fetchRegionSeq(region, opts)
        : undefined
      // Marks the promise handled so a rejection nobody has awaited yet does not
      // surface as an unhandled rejection — a sequence source can 404 on a
      // contig the BAM has and the assembly does not, which is the ordinary
      // shape of a refName mismatch. It does NOT swallow the error: attaching a
      // handler here leaves `prefetched` itself rejected, so the await below
      // still throws exactly where the un-prefetched path would. Degrading to
      // "no reference" instead would make the same failure behave differently
      // depending on whether it was the first query.
      prefetched?.catch(() => {})

      // A failed region fetch (e.g. a transient network error mid-pan) must not
      // wipe the header/index caches — those are memoized in setup() and only
      // invalidated on a setup failure. Re-downloading them on every dropped
      // data chunk would force a full re-download on the next pan.
      //
      // The signal is what makes cancellation reach the socket: without it a
      // canceled navigation stops *processing* the reads but downloads every
      // byte of the range to completion first.
      const records = await withStopTokenSignal(stopToken, signal =>
        downloadStatus('Downloading alignments', statusCallback, onProgress =>
          bam.getRecordsForRange(refName, start, end, { onProgress, signal }),
        ),
      )
      checkStopToken(stopToken)

      const {
        readName,
        tagFilters,
        spliced,
        flagInclude = 0,
        flagExclude = 0,
      } = filterBy ?? {}
      // Only reads lacking an MD tag need the reference, and whether ANY does is
      // only knowable once the records are in — hence `span` below. But the
      // SPAN itself needs no records: seqFetchSpan clamps to [start, end), so
      // the queried region is already an upper bound on what it can return, and
      // a PackedReference carries its own start, so one packed for the whole
      // region locates any read in itself and the walk windows to the viewport
      // regardless. That is what lets the read be issued alongside the
      // alignment fetch instead of after it — measured serial at every latency,
      // and ~20% of a cold query at a CDN-like RTT (seqfetch-timing-probe.ts).
      const span = seqFetchSpan(records, start, end)
      // MD-ness is a property of the FILE — the aligner either wrote MD or it
      // did not — so one query's answer predicts the next one's. This is what
      // keeps the prefetch above free on a BAM that carries MD: the gate never
      // opens, and no query on it ever reads sequence at all.
      if (span) {
        this.needsReference = true
      }
      // `prefetched ?? this.fetchRegionSeq(…)` is WRONG here and was caught by
      // referencePrefetch.test.ts: `??` evaluates its right side eagerly, so it
      // read sequence on the first query of every BAM including the MD-carrying
      // ones — defeating the gate it sits under. The fetch has to be inside the
      // `span` branch.
      const regionSeq = span
        ? await (prefetched ?? this.fetchRegionSeq(region, opts))
        : undefined
      // Packed once for the whole fetch, not per read: the walk then compares
      // two bases per byte against the read's own packed SEQ. Anchored at the
      // region rather than at `span`, because that is what was fetched.
      const packedRef = regionSeq
        ? packReference(regionSeq, region.start)
        : undefined

      await withProgress(
        {
          label: 'Processing alignments',
          total: records.length,
          statusCallback,
          stopToken,
        },
        report => {
          for (const record of records) {
            report()
            // Every filter is applied here rather than split with @gmod/bam,
            // which used to take flags + a single tagFilter. That seam was also
            // dead: normalizeFilterBy folds the legacy singular `tagFilter`
            // into `tagFilters`, so @gmod/bam never saw one. Mirrors
            // CramAdapter's shouldFilterRecord. Filtering here is free — this
            // loop already visits every record to set `adapter` and resolve the
            // reference.
            if (filterReadFlag(record.flags, flagInclude, flagExclude)) {
              continue
            }
            // `!== undefined`, not truthy: matches CramAdapter/SamAdapter, where
            // an explicitly-set empty readName filters rather than being ignored.
            if (readName !== undefined && record.name !== readName) {
              continue
            }
            // Multiple tag filters are AND-ed (excluded if any one rejects the
            // read). getTag decodes just the one tag; record.tags would decode
            // every unrelated tag on the read (NM/AS/ms/de/…) to test one.
            if (
              tagFilters?.some(tf =>
                filterTagValue(record.getTag(tf.tag), tf.value),
              )
            ) {
              continue
            }
            if (
              filterSpliced(spliced, () =>
                numericCigarHasSkip(record.NUMERIC_CIGAR),
              )
            ) {
              continue
            }

            record.adapter = this

            // Share the one packed region ref; it carries the region's start,
            // so it locates this read in itself.
            // A VIEW, not a write: these records come out of @gmod/bam's chunk
            // LRU, so two queries hitting the same chunk span share objects and
            // an assignment would rebind the read for whichever fetch still
            // holds it. See BamSlightlyLazyFeature.withRegionRef.
            observer.next(
              !record.NUMERIC_MD && packedRef && span
                ? record.withRegionRef(packedRef)
                : record,
            )
          }
          observer.complete()
        },
      )
    })
  }

  // Index-only estimate, no read download. htsget has no index to measure, so
  // it reports none and its reads are never byte-gated.
  async getRegionByteSize(regions: Region[]) {
    const { bam } = this.configure()
    return bam.index ? bam.estimatedBytesForRegions(regions) : undefined
  }
}
