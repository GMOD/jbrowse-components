import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { dedupe } from '@jbrowse/core/util'
import {
  type DiagonalizationResult,
  diagonalizeRegions,
} from '@jbrowse/core/util/diagonalizeRegions'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { extractAlignmentData } from '@jbrowse/synteny-core'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DiagonalizeDotplot: {
      args: DiagonalizeDotplotArgs
      return: DiagonalizationResult
    }
  }
}

export interface DiagonalizeDotplotArgs {
  sessionId: string
  // horizontal axis (already renamed into the adapter's refName namespace on the
  // main thread): drives the getFeatures query and the reference ordering
  referenceRegions: Region[]
  // vertical axis, kept in canonical namespace because the reordered result is
  // handed straight back to the view
  currentRegions: Region[]
  // adapter refName -> canonical refName for the vertical axis, so fetched
  // alignments line up with the canonical currentRegions
  queryRefNameMap: Record<string, string>
  adapterConfig: Record<string, unknown>
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

export default class DiagonalizeDotplotRpc extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'DiagonalizeDotplot'

  async execute(args: DiagonalizeDotplotArgs, rpcDriverClassName: string) {
    const {
      referenceRegions,
      currentRegions,
      queryRefNameMap,
      sessionId,
      adapterConfig,
      stopToken,
      statusCallback,
    } = await this.deserializeArguments(args, rpcDriverClassName)

    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkStopToken(stopToken)
    statusCallback?.('Fetching features')

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const feats = dedupe(
      await (
        dataAdapter as BaseFeatureDataAdapter
      ).getFeaturesInMultipleRegionsArray(referenceRegions, {
        sessionId,
        stopToken,
        statusCallback,
      }),
      f => f.id(),
    )

    checkStopToken(stopToken)
    statusCallback?.('Extracting alignment data')

    // referenceRegions are already adapter-space (renamed on the main thread),
    // so the reference axis needs no translation; only the query axis is mapped
    // back to canonical to line up with the canonical currentRegions.
    const alignments = extractAlignmentData(feats, { queryRefNameMap })

    if (alignments.length === 0) {
      throw new Error('No alignments found to diagonalize')
    }

    statusCallback?.(
      `Running diagonalization on ${alignments.length} alignments`,
    )

    const result = await diagonalizeRegions(
      alignments,
      referenceRegions,
      currentRegions,
      () => {
        checkStopToken(stopToken)
      },
    )

    statusCallback?.('Diagonalization complete!')
    return result
  }
}

export { type DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'
