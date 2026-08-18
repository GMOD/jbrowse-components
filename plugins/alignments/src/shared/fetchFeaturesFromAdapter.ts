import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { FilterBy } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * Resolve the data adapter, attach the sequence adapter (if any), fetch all
 * features for the region, and return them alongside the adapter and the
 * stop-token checker. Both pileup and chain executors begin with this exact
 * sequence; centralising it prevents drift in the adapter wiring contract.
 */
export async function fetchFeaturesFromAdapter({
  pluginManager,
  sessionId,
  adapterConfig,
  sequenceAdapter,
  region,
  filterBy,
  lodMode,
  statusCallback,
  stopToken,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region: Region
  filterBy?: FilterBy
  // Which detail tier a tiered adapter should serve. Only the synteny displays
  // set it (a PIF has a coarse no-CIGAR tier); read adapters ignore it.
  lodMode?: BaseOptions['lodMode']
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
  stopToken?: StopToken
}) {
  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
  })

  const fetchOpts: BaseOptions & { filterBy?: FilterBy } = {
    stopToken,
    filterBy,
    lodMode,
    statusCallback,
  }
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeatures(region, fetchOpts).pipe(toArray()),
  )

  checkStopTokenThrottled(stopTokenCheck)

  return {
    featuresArray,
    dataAdapter,
    stopTokenCheck,
  }
}
