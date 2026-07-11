import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { dedupe } from '@jbrowse/core/util'
import {
  type AlignmentData,
  type DiagonalizationResult,
  diagonalizeRegions,
} from '@jbrowse/core/util/diagonalizeRegions'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { extractAlignmentData } from '@jbrowse/synteny-core'

import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// One alignment adapter drawn in a level, plus the per-adapter refName
// reconciliation the worker needs (it has no assemblyManager to resolve
// aliases, and each adapter has its own namespace):
// - fetchRegions:    the reference regions renamed into this adapter's namespace
//                    for the getFeatures query
// - refRefNameMap /
//   queryRefNameMap: adapter refName -> canonical, per axis, to translate the
//                    fetched alignments back so they match the canonical
//                    reference/current regions below
interface DiagonalizeSyntenyAdapter {
  adapterConfig: Record<string, unknown>
  fetchRegions: Region[]
  refRefNameMap: Record<string, string>
  queryRefNameMap: Record<string, string>
}

// One synteny level (the gap between two adjacent views): the alignment
// adapters drawn there, the region set of the reference view (above), and the
// region set of the view being reordered (below). Called once per level so each
// routes to the same worker its track renders on (rpcSessionId is per-track),
// reusing that worker's already-parsed adapters. referenceRegions/currentRegions
// stay in canonical namespace — the algorithm matches against them and hands
// currentRegions (reordered) straight back to the view.
export interface DiagonalizeSyntenyArgs {
  sessionId: string
  adapters: DiagonalizeSyntenyAdapter[]
  referenceRegions: Region[]
  currentRegions: Region[]
  // the assembly on the query axis (the row being reordered); a multi-genome
  // adapter uses it to select which of its N-1 pairs this level draws
  targetAssemblyName?: string
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
      adapters,
      referenceRegions,
      currentRegions,
      targetAssemblyName,
      bpPerPx,
      sessionId,
      stopToken,
      statusCallback,
    } = await this.deserializeArguments(args, rpcDriverClassName)

    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    // Phase labels mirror DiagonalizeDotplotRpc so both views report the same
    // progression; the getFeatures call upgrades "Fetching features" to a
    // determinate download/parse bar while it runs. Fetch sequentially (not
    // Promise.all): the adapters share one statusCallback, so concurrent
    // fetches would clobber each other's bar.
    statusCallback?.('Fetching features')

    const alignments: AlignmentData[] = []
    for (const {
      adapterConfig,
      fetchRegions,
      refRefNameMap,
      queryRefNameMap,
    } of adapters) {
      const dataAdapter = await getFeatureAdapterOrThrow({
        pluginManager: this.pluginManager,
        sessionId,
        adapterConfig,
      })
      const feats = dedupe(
        await dataAdapter.getFeaturesInMultipleRegionsArray(fetchRegions, {
          stopToken,
          bpPerPx,
          statusCallback,
          targetAssemblyName,
        }),
        f => f.id(),
      )
      // append element-by-element, not `push(...arr)`: whole-genome synteny
      // yields hundreds of thousands of alignments, and spreading that many
      // args overflows the call stack ("Maximum call stack size exceeded")
      for (const a of extractAlignmentData(feats, {
        refRefNameMap,
        queryRefNameMap,
      })) {
        alignments.push(a)
      }
    }

    if (alignments.length === 0) {
      return null
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
