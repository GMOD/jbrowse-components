import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { LDDataResult } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'

export interface RenderLDDataArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  /**
   * Absolute axis-bp position of the first fetched block's leading edge, which
   * the payload's pre-rotation coordinates are relative to. Echoed into the
   * result untouched: the model needs the origin the *payload* was laid out
   * against — not a live re-derivation — to place a stale triangle correctly
   * while a refetch is in flight.
   */
  originBp: number
  ldMetric: LDMetric
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  hweFilterThreshold: number
  callRateFilter: number
  /** plink's `--ld-window`; 0 for the full triangle. See `ldBand.ts`. */
  maxVariantSeparation: number
  jexlFilters: string[]
  signedLD: boolean
  useGenomicPositions: boolean
  /**
   * `resolvedByteLimit()`. Absent means the gate may not act, and the executor
   * then measures nothing.
   */
  byteLimit?: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderLDData: {
      args: RenderLDDataArgs
      return: LDDataResult | RegionTooLargeResult
      // Only the data half owns buffers to transfer, so only it is wrapped —
      // the refusal marker crosses as itself.
      //
      // The odd one out among the Render* family until now: `ldValues` is the
      // O(n²) pair matrix — 4MB at a thousand SNPs — and it crossed by structure
      // clone on every fetch, alongside three more Float32Arrays. Every buffer
      // in the result is freshly allocated per call (`getLDMatrix`,
      // `getLDMatrixFromPlink`, `computeBoundaries`, `buildGenomicCellBuffers`,
      // and both empty results), so there is nothing held across calls for the
      // transfer to detach.
      transferables: LDDataResult
    }
  }
}

export default class RenderLDData extends RpcMethodTypeWithRenameRegions<'RenderLDData'> {
  name = 'RenderLDData' as const

  async execute(args: RpcExecuteArgs<'RenderLDData'>) {
    const { executeRenderLDData } = await import('./executeRenderLDData.ts')
    return executeRenderLDData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
