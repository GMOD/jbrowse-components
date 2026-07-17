import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { dedupe } from '@jbrowse/core/util'
import { diagonalizeRegions } from '@jbrowse/core/util/diagonalizeRegions'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { extractAlignmentData } from './extractAlignmentData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type {
  AlignmentData,
  DiagonalizationResult,
} from '@jbrowse/core/util/diagonalizeRegions'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// One alignment adapter to diagonalize against, plus the per-adapter refName
// reconciliation the worker needs (it has no assemblyManager to resolve
// aliases, and each adapter has its own namespace):
// - fetchRegions:    the reference regions renamed into this adapter's namespace
//                    for the getFeatures query
// - refRefNameMap /
//   queryRefNameMap: adapter refName -> canonical, per axis, to translate the
//                    fetched alignments back so they match the canonical
//                    reference/current regions
//
// Build one with `prepareDiagonalizeAdapter` on the main thread.
export interface DiagonalizeAdapterSpec {
  adapterConfig: Record<string, unknown>
  fetchRegions: Region[]
  refRefNameMap: Record<string, string>
  queryRefNameMap: Record<string, string>
}

// referenceRegions/currentRegions stay in the canonical namespace: the
// algorithm matches against them and hands currentRegions (reordered) straight
// back to the view.
export interface DiagonalizeArgs {
  sessionId: string
  // the alignment adapters drawn between this pair of axes; the synteny view
  // passes one per display in a level, the dotplot passes its single display
  adapters: DiagonalizeAdapterSpec[]
  // the axis that supplies the ordering (synteny: the row above; dotplot: the
  // horizontal axis)
  referenceRegions: Region[]
  // the axis being reordered (synteny: the row below; dotplot: the vertical
  // axis). Its assembly is also the pair selector handed to the adapter — see
  // targetAssemblyName in the body.
  currentRegions: Region[]
  // forwarded to getFeatures for adapters with bpPerPx-driven level-of-detail.
  // Optional on purpose: the synteny view passes its reference view's zoom, the
  // dotplot passes nothing so its diagonalize fetch stays LOD-unculled.
  bpPerPx?: number
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

/**
 * Fetch a pair of axes' alignments and run the shared `diagonalizeRegions` off
 * the main thread. Shared by the linear-synteny and dotplot diagonalize RPCs —
 * a dotplot is the single-adapter case of a synteny level — so the two can't
 * drift. They previously did: only the synteny copy forwarded
 * `targetAssemblyName`, so a dotplot on a multi-genome track diagonalized
 * against the wrong pair's alignments.
 *
 * Returns null when the pair has no alignments to reorder, rather than
 * throwing, so an empty pair reads as "nothing to do" and an init-time
 * auto-diagonalize still resolves instead of stalling.
 */
export async function executeDiagonalize(
  pluginManager: PluginManager,
  {
    sessionId,
    adapters,
    referenceRegions,
    currentRegions,
    bpPerPx,
    stopToken,
    statusCallback,
  }: DiagonalizeArgs,
): Promise<DiagonalizationResult | null> {
  if (!sessionId) {
    throw new Error('must pass a unique session id')
  }
  checkStopToken(stopToken)

  // Which of its N-1 pairs a multi-genome adapter (MCScanBlocksAdapter,
  // AllVsAllPAFAdapter) should return: the assembly being reordered. Derived
  // rather than taken as an argument — it is exactly currentRegions' assembly,
  // so a caller could only ever pass the same value or a wrong one. Forgetting
  // to pass it is what made the dotplot diagonalize against the wrong band
  // while the synteny view worked.
  const targetAssemblyName = currentRegions[0]?.assemblyName

  // The getFeatures call upgrades "Fetching features" to a determinate
  // download/parse bar while it runs. Fetch sequentially (not Promise.all): the
  // adapters share one statusCallback, so concurrent fetches would clobber each
  // other's bar.
  statusCallback?.('Fetching features')

  const alignments: AlignmentData[] = []
  for (const {
    adapterConfig,
    fetchRegions,
    refRefNameMap,
    queryRefNameMap,
  } of adapters) {
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager,
      sessionId,
      adapterConfig,
    })
    const feats = dedupe(
      await dataAdapter.getFeaturesInMultipleRegionsArray(fetchRegions, {
        sessionId,
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

  statusCallback?.(`Running diagonalization on ${alignments.length} alignments`)
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
