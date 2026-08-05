import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { toMafStatus } from './mafStatus.ts'
import { subscribeToObservable } from './observableUtils.ts'

import type { MafSummaryRecord } from '../types.ts'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

/**
 * The memoization slot the helpers below keep their resolved sub-adapter on.
 * Declared by each MAF adapter as a public field, the same shape `setupP` takes
 * for the primary adapter.
 */
export interface MafSummaryHolder {
  summaryAdapterP?: Promise<BaseFeatureDataAdapter | undefined>
}

type MafSummarySelf = BaseFeatureDataAdapter & MafSummaryHolder

/**
 * Resolve the `summaryAdapter` slot to a data adapter, or undefined when the
 * slot is unset. Whatever the slot names is what gets loaded — the summary
 * source is swappable, like CRAM's `getSequenceAdapter` — so a BigMaf track
 * points it at a `BigBedAdapter` over UCSC's `bigMafSummary.bb` while a tabix
 * or TAF track points it at a `BedTabixAdapter` over a summary BED.
 *
 * Memoized on failure-clearing terms so a transient error retries rather than
 * caching the rejection for the session.
 */
export async function loadMafSummaryAdapter(self: MafSummarySelf) {
  const config = self.getConf('summaryAdapter')
  if (!config || !self.getSubAdapter) {
    return undefined
  }
  self.summaryAdapterP ??= self
    .getSubAdapter(config)
    .then(result => result.dataAdapter as BaseFeatureDataAdapter)
    .catch((e: unknown) => {
      self.summaryAdapterP = undefined
      throw e
    })
  return self.summaryAdapterP
}

/**
 * Per-species alignment-block rows for zoom-out rendering: one record per
 * (species, region) with a score and left/right context, and **no sequence** —
 * which is the entire point, since the sequence is what makes the full
 * alignment fetch unaffordable at genome scale.
 *
 * Shared by all three MAF adapters. It reads named fields off whatever the
 * sub-adapter yields rather than a format-specific record, which is what lets
 * one implementation serve both sources: UCSC's `bigMafSummary.bb` declares
 * `src`/`score`/`leftStatus`/`rightStatus` in its autoSql, and a summary BED
 * names the same columns in its `#` header line (`BedTabixAdapter` reads column
 * names from the header when `columnNames` is unset, and `featureData` drops
 * `chrom`/`chromStart`/`chromEnd` in favor of the tabix-supplied ones).
 *
 * Emits nothing when no `summaryAdapter` is configured — callers fall back to
 * the byte-estimate force-load gate.
 */
export function mafSummaryFeatures(
  self: MafSummarySelf,
  query: Region,
  opts?: BaseOptions,
) {
  return ObservableCreate<MafSummaryRecord>(async observer => {
    const adapter = await loadMafSummaryAdapter(self)
    if (adapter) {
      await subscribeToObservable(adapter.getFeatures(query, opts), f => {
        observer.next({
          refName: f.get('refName'),
          start: f.get('start'),
          end: f.get('end'),
          src: f.get('src') as string,
          score: f.get('score')!,
          leftStatus: toMafStatus(f.get('leftStatus') as string | undefined),
          rightStatus: toMafStatus(f.get('rightStatus') as string | undefined),
        })
      })
    }
    observer.complete()
  }, opts?.stopToken)
}
