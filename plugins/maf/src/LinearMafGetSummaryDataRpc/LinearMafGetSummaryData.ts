import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { subscribeToObservable } from '../util/observableUtils.ts'

import type { MafSamplesAdapter, MafSummaryRecord, Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Observable } from 'rxjs'

// Only BigMafAdapter ships a summary sub-adapter; the tabix/TAF adapters don't,
// so the method is tolerant of its absence (returns no rows → display falls
// back to the byte-estimate force-load gate).
type SummaryCapableAdapter = MafSamplesAdapter & {
  getSummaryFeatures?: (
    region: Region,
    opts?: { stopToken?: StopToken },
  ) => Observable<MafSummaryRecord>
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetSummaryData: {
      args: LinearMafGetSummaryDataArgs
      return: LinearMafGetSummaryDataResult
    }
  }
}

export interface LinearMafGetSummaryDataArgs {
  adapterConfig: AnyConfigurationModel
  sessionId: string
  region: Region
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

export interface LinearMafGetSummaryDataResult {
  samples: Sample[]
  treeNewick: string | undefined
  records: MafSummaryRecord[]
}

/**
 * Fetch the per-species `bigMafSummary` rows for a single region — one row per
 * alignment block × species, carrying score + gap/break status but no
 * sequence. This is the cheap zoom-out path: the summary BigBed's bedToBigBed
 * zoom-level reduction makes wide reads small, where the full alignment fetch
 * would download every species' bases.
 */
export default class LinearMafGetSummaryData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'LinearMafGetSummaryData'

  async execute(
    args: LinearMafGetSummaryDataArgs,
    rpcDriverClassName: string,
  ): Promise<LinearMafGetSummaryDataResult> {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { region, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const adapter = dataAdapter as SummaryCapableAdapter

    // Sample set + tree ship with the summary response too, so a track opened
    // already zoomed out (never fetched detail) still has its row order + tree.
    const { samples, treeNewick } = await adapter.getSamples()

    const records: MafSummaryRecord[] = []
    const obs = adapter.getSummaryFeatures?.(region, {
      stopToken: deserializedArgs.stopToken,
    })
    if (obs) {
      await subscribeToObservable(obs, record => {
        records.push(record)
      })
    }
    return { samples, treeNewick, records }
  }
}
