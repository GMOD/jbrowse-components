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
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// One synteny level (the gap between two adjacent views): the alignment
// adapters drawn there plus the region sets of the reference view (above) and
// the view being reordered (below).
export interface DiagonalizeSyntenyLevel {
  adapterConfigs: Record<string, unknown>[]
  referenceRegions: Region[]
  currentRegions: Region[]
  bpPerPx: number
}

export interface DiagonalizeSyntenyArgs {
  sessionId: string
  levels: DiagonalizeSyntenyLevel[]
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

// Per-level result, parallel to the input `levels`; null where a level has no
// alignments to reorder. The caller applies result[i].newRegions to view i+1.
export interface DiagonalizeSyntenyResult {
  results: (DiagonalizationResult | null)[]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DiagonalizeSynteny: {
      args: DiagonalizeSyntenyArgs
      return: DiagonalizeSyntenyResult
    }
  }
}

// Worker-side counterpart to DiagonalizeDotplot: fetches each level's
// alignments and runs the shared diagonalizeRegions off the main thread.
// Synteny is multi-level (N views -> N-1 levels), so it loops where the dotplot
// RPC handles a single pair.
export default class DiagonalizeSyntenyRpc extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'DiagonalizeSynteny'

  async execute(args: DiagonalizeSyntenyArgs, rpcDriverClassName: string) {
    const { levels, sessionId, stopToken, statusCallback } =
      await this.deserializeArguments(args, rpcDriverClassName)

    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    const results: (DiagonalizationResult | null)[] = []
    for (const [i, level] of levels.entries()) {
      checkStopToken(stopToken)
      statusCallback?.(`Diagonalizing level ${i + 1} of ${levels.length}`)

      const alignments: AlignmentData[] = []
      for (const adapterConfig of level.adapterConfigs) {
        const { dataAdapter } = await getAdapter(
          this.pluginManager,
          sessionId,
          adapterConfig,
        )
        const feats = dedupe(
          await firstValueFrom(
            (dataAdapter as BaseFeatureDataAdapter)
              .getFeaturesInMultipleRegions(level.referenceRegions, {
                stopToken,
                bpPerPx: level.bpPerPx,
                statusCallback,
              })
              .pipe(toArray()),
          ),
          f => f.id(),
        )
        alignments.push(...extractAlignmentData(feats))
      }

      results.push(
        alignments.length === 0
          ? null
          : await diagonalizeRegions(
              alignments,
              level.referenceRegions,
              level.currentRegions,
              () => {
                checkStopToken(stopToken)
              },
            ),
      )
    }

    return { results }
  }
}
