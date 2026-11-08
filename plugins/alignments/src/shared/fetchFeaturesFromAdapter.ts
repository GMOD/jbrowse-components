import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseOptions,
  LodTier,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/**
 * Resolve the data adapter, attach the sequence adapter (if any), and fetch
 * every feature in the region: the read fetch each alignments RPC starts with.
 */
export async function fetchFeaturesFromAdapter({
  pluginManager,
  sessionId,
  adapterConfig,
  sequenceAdapter,
  region,
  filter,
  lodTier,
  statusCallback,
  signal,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region: Region
  filter?: FieldPredicate[]
  // Which detail tier a tiered adapter should serve. Only the synteny displays
  // set it (a PIF has a coarse no-CIGAR tier); read adapters ignore it.
  lodTier?: LodTier
  // Required key, nullable value, on purpose: a caller with no status channel
  // has to say `statusCallback: undefined` rather than leave the property out,
  // so forwarding one is a decision instead of something to remember. And
  // `undefined` is the meaningful answer, not a shrug — it tells a reader to
  // skip its progress bookkeeping entirely (`downloadStatusReporter` returns
  // undefined for exactly that), which is why `() => {}` is the wrong way to say
  // it and was what GetConsensusSequence had hard-coded. The `res.bytes()` path
  // it selects is not a *fast* path, whatever this comment claimed before it was
  // measured — agent-docs/measurements/download-read-path.json.
  statusCallback: StatusCallback | undefined
  signal?: AbortSignal
}) {
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
  })

  const fetchOpts: BaseOptions & { filter?: FieldPredicate[] } = {
    signal,
    filter,
    lodTier,
    statusCallback,
  }
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeatures(region, fetchOpts).pipe(toArray()),
  )

  checkAbortSignal(signal)

  return { featuresArray }
}
