import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { dedupe } from '@jbrowse/core/util'
import {
  type DiagonalizationResult,
  diagonalizeRegions,
} from '@jbrowse/core/util/diagonalizeRegions'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { extractAlignmentData } from '@jbrowse/synteny-core'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

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
  view: {
    hview: { displayedRegions: Region[] }
    vview: { displayedRegions: Region[] }
  }
  adapterConfig: Record<string, unknown>
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

export default class DiagonalizeDotplotRpc extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'DiagonalizeDotplot'

  async execute(args: DiagonalizeDotplotArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { view, sessionId, adapterConfig, stopToken, statusCallback } =
      deserializedArgs

    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    statusCallback?.('Initializing diagonalization...')

    checkStopToken(stopToken)
    statusCallback?.('Fetching features...')

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const feats = dedupe(
      await firstValueFrom(
        (dataAdapter as BaseFeatureDataAdapter)
          .getFeaturesInMultipleRegions(view.hview.displayedRegions, {
            sessionId,
            stopToken,
            statusCallback,
          })
          .pipe(toArray()),
      ),
      f => f.id(),
    )

    checkStopToken(stopToken)
    statusCallback?.('Extracting alignment data...')

    const alignments = extractAlignmentData(feats)

    if (alignments.length === 0) {
      throw new Error('No alignments found to diagonalize')
    }

    statusCallback?.(
      `Running diagonalization on ${alignments.length} alignments...`,
    )

    const result = await diagonalizeRegions(
      alignments,
      view.hview.displayedRegions,
      view.vview.displayedRegions,
      () => {
        checkStopToken(stopToken)
      },
    )

    statusCallback?.('Diagonalization complete!')
    return result
  }
}

export { type DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'
