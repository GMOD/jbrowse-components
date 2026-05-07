import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { FilterBy } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * Resolve the data adapter, attach the sequence adapter (if any), fetch all
 * features for the region, and return the canonical regionStart/stopTokenCheck.
 * Both pileup and chain executors begin with this exact sequence; centralising
 * it prevents drift in the adapter wiring contract.
 */
export async function fetchFeaturesFromAdapter({
  pluginManager,
  sessionId,
  adapterConfig,
  sequenceAdapter,
  region,
  filterBy,
  statusCallback,
  stopToken,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region: Region
  filterBy?: FilterBy
  statusCallback: (s: string) => void
  stopToken?: StopToken
}) {
  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
    dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
  }

  const fetchOpts: BaseOptions & { filterBy?: FilterBy } = {
    stopToken,
    filterBy,
    statusCallback,
  }
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeatures(region, fetchOpts).pipe(toArray()),
  )

  checkStopToken2(stopTokenCheck)

  return {
    featuresArray,
    dataAdapter,
    stopTokenCheck,
    regionStart: Math.floor(region.start),
  }
}
