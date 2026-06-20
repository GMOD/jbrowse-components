import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { dedupe } from '@jbrowse/core/util'
import {
  type AlignmentData,
  type DiagonalizationResult,
  diagonalizeRegions,
} from '@jbrowse/core/util/diagonalizeRegions'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { extractAlignmentData } from '@jbrowse/synteny-core'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// One synteny level (the gap between two adjacent views): the alignment
// adapters drawn there, the region set of the reference view (above), and the
// region set of the view being reordered (below). Called once per level so each
// routes to the same worker its track renders on (rpcSessionId is per-track),
// reusing that worker's already-parsed adapters.
export interface DiagonalizeSyntenyArgs {
  sessionId: string
  adapterConfigs: Record<string, unknown>[]
  referenceRegions: Region[]
  currentRegions: Region[]
  bpPerPx: number
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DiagonalizeSynteny: {
      args: DiagonalizeSyntenyArgs
      // null when the level has no alignments to reorder
      return: DiagonalizationResult | null
    }
  }
}

// Worker-side counterpart to DiagonalizeDotplot: fetches a level's alignments
// and runs the shared diagonalizeRegions off the main thread.
export default class DiagonalizeSyntenyRpc extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'DiagonalizeSynteny'

  async execute(args: DiagonalizeSyntenyArgs, rpcDriverClassName: string) {
    const {
      adapterConfigs,
      referenceRegions,
      currentRegions,
      bpPerPx,
      sessionId,
      stopToken,
      statusCallback,
    } = await this.deserializeArguments(args, rpcDriverClassName)

    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    const alignments: AlignmentData[] = []
    for (const adapterConfig of adapterConfigs) {
      const { dataAdapter } = await getAdapter(
        this.pluginManager,
        sessionId,
        adapterConfig,
      )
      const feats = dedupe(
        await (
          dataAdapter as BaseFeatureDataAdapter
        ).getFeaturesInMultipleRegionsArray(referenceRegions, {
          stopToken,
          bpPerPx,
          statusCallback,
        }),
        f => f.id(),
      )
      // append element-by-element, not `push(...arr)`: whole-genome synteny
      // yields hundreds of thousands of alignments, and spreading that many
      // args overflows the call stack ("Maximum call stack size exceeded")
      for (const a of extractAlignmentData(feats)) {
        alignments.push(a)
      }
    }

    if (alignments.length === 0) {
      return null
    }

    statusCallback?.(
      `Running diagonalization on ${alignments.length} alignments`,
    )
    return diagonalizeRegions(
      alignments,
      referenceRegions,
      currentRegions,
      () => {
        checkStopToken(stopToken)
      },
    )
  }
}
