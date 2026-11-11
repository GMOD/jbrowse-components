import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { summarizeGroupByCandidates } from '@jbrowse/core/util/groupByCandidates'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Feature } from '@jbrowse/core/util'
import type { GroupByCandidate } from '@jbrowse/core/util/groupByCandidates'
import type { Region } from '@jbrowse/core/util/types/data'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MarkGetFieldCandidates: {
      args: {
        adapterConfig: Record<string, unknown>
        regions: Region[]
        byteLimit: number | undefined
      }
      return: GroupByCandidate[] | RegionTooLargeResult
    }
  }
}

/**
 * The fields the features in view carry, each with its values
 * (`summarizeGroupByCandidates`), for the attribute pickers: the render
 * fetch's download over the visible blocks, refused where the display's byte
 * budget refuses it. A feature two blocks both answer counts once.
 */
export default class MarkGetFieldCandidates extends RpcMethodTypeWithRenameRegions<'MarkGetFieldCandidates'> {
  name = 'MarkGetFieldCandidates' as const

  async execute(args: RpcExecuteArgs<'MarkGetFieldCandidates'>) {
    const { regions, byteLimit, signal, statusCallback } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })
    const { tooLarge } = await measureRegionBytes({
      dataAdapter,
      regions,
      byteLimit,
      signal,
      statusCallback,
    })
    return tooLarge ?? summarizeGroupByCandidates(await featuresIn())

    async function featuresIn() {
      const byId = new Map<string, Feature>()
      for (const region of regions) {
        const fetched = await updateStatus(
          'Downloading features',
          statusCallback,
          () =>
            dataAdapter.getFeaturesArray(region, { signal, statusCallback }),
        )
        checkAbortSignal(signal)
        for (const feature of fetched) {
          byId.set(feature.id(), feature)
        }
      }
      return byId.values()
    }
  }
}
