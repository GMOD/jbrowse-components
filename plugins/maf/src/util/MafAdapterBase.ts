import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'

import { getSamplesFromAdapter } from './getSamples.ts'
import {
  loadMafSummaryAdapter,
  mafSummaryFeatures,
} from './loadMafSummaryAdapter.ts'
import { mafFeatureTable } from './mafFeatureTable.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  RowSourceLister,
  RowSourceListing,
} from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { Region } from '@jbrowse/core/util'

/**
 * What every MAF adapter is beyond its own file format: a sample set and a
 * zoom-out tier, off the slots `mafAdapterConfigSchemaFields` gives all four.
 *
 * This class IS the contract the MAF RPCs load against — `loadMafSamplesAdapter`
 * checks `instanceof` — which is what makes the four members below the whole of
 * it. They used to be described by a structural `MafSamplesAdapter` type that
 * any object with the right method names satisfied, so the way to lose the byte
 * gate was to write an adapter that simply did not declare `summaryAdapter`.
 */
export abstract class MafAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
>
  extends BaseFeatureDataAdapter<CONF>
  implements RowSourceLister
{
  summaryAdapter = cachedSetup({
    setup: () => loadMafSummaryAdapter(this),
  })

  getSamples = cachedSetup({
    setup: () => getSamplesFromAdapter(this),
  })

  async listRowSources(opts?: BaseOptions): Promise<RowSourceListing> {
    const { samples, treeNewick } = await this.getSamples(opts)
    return {
      field: 'alignments',
      sources: samples.map(({ id, label, color }) => ({
        name: id,
        ...(label && label !== id ? { label } : {}),
        ...(color ? { color } : {}),
      })),
      ...(treeNewick === undefined ? {} : { tree: treeNewick }),
    }
  }

  override getFeatureTable(query: Region, opts?: BaseOptions) {
    return mafFeatureTable(this.getFeatures(query, opts), query.refName)
  }

  // The zoom-out tier: per-species alignment-block rows with no sequence, from
  // whatever the `summaryAdapter` slot names. See the slot's own comment for why
  // even a `.tai`-indexed adapter needs one.
  getSummaryFeatures(query: Region, opts?: BaseOptions) {
    return mafSummaryFeatures(this, query, opts)
  }
}
