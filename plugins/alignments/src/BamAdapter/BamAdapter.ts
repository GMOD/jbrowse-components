import { BamFile } from '@gmod/bam'
import { packReference } from '@jbrowse/cigar-utils'
import { downloadStatus, withProgress } from '@jbrowse/core/util'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken,
  withStopTokenSignal,
} from '@jbrowse/core/util/stopToken'

import { BaseSamAdapter } from '../shared/BaseSamAdapter.ts'
import { seqFetchSpan } from '../shared/seqFetchSpan.ts'
import { filterReadFlag, filterTagValue } from '../shared/util.ts'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature.ts'

import type { FilterBy } from '../shared/types.ts'
import type { BamAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export default class BamAdapter extends BaseSamAdapter<BamAdapterConfig> {
  protected configureResult?: { bam: BamFile<BamSlightlyLazyFeature> }

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
    const { refName, start, end, originalRefName } = region
    const { stopToken, filterBy, statusCallback = () => {} } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      await this.setup(opts)
      const { bam } = this.configure()
      checkStopToken(stopToken)

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
        flagInclude = 0,
        flagExclude = 0,
      } = filterBy ?? {}
      // only reads lacking an MD tag need the reference, so defer loading the
      // sequence adapter (and the fetch) until we know at least one does
      const span = seqFetchSpan(records, start, end)
      const sequenceAdapter = span ? await this.getSequenceAdapter() : undefined
      const regionSeq =
        sequenceAdapter && span
          ? await sequenceAdapter.getSequence({
              refName: originalRefName ?? refName,
              start: span.start,
              end: span.end,
            })
          : undefined
      // Packed once for the whole fetch, not per read: the walk then compares
      // two bases per byte against the read's own packed SEQ.
      const packedRef = regionSeq ? packReference(regionSeq) : undefined

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

            record.adapter = this

            // Share the one packed region ref; refOffset locates this read in it.
            // A VIEW, not a write: these records come out of @gmod/bam's chunk
            // LRU, so two queries hitting the same chunk span share objects and
            // an assignment would rebind the read for whichever fetch still
            // holds it. See BamSlightlyLazyFeature.withRegionRef.
            observer.next(
              !record.NUMERIC_MD && packedRef && span
                ? record.withRegionRef(packedRef, record.start - span.start)
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
