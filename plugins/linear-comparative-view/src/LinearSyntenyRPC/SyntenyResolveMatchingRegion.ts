import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import { findAlignmentById } from './findAlignmentById.ts'

import type { AlignmentLookupArgs } from './findAlignmentById.ts'
import type { ResolvedSpan, SpanOfInterest } from './resolveAlignmentSpan.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

/**
 * The lookup, plus the window to walk once the alignment is in hand.
 *
 * The inherited `lodMode` carries a second meaning here that it does not carry
 * for the map: it is the tier whose alignment strings decide whether there is
 * an answer at all — a CIGAR, or the coarse tier's fold of one.
 */
export interface SyntenyResolveMatchingRegionArgs extends AlignmentLookupArgs {
  // The visible window of the panel that is STAYING, in that panel's own
  // genomic coordinates.
  window: SpanOfInterest
  // true when the panel being moved is on the mate axis, false when it is on
  // the feature axis
  toMate: boolean
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyResolveMatchingRegion: {
      args: SyntenyResolveMatchingRegionArgs
      return: ResolvedSpan | undefined
    }
  }
}

/**
 * Where one panel of a synteny view should navigate so that the clicked band
 * runs vertically between it and its neighbour.
 *
 * IT RETURNS THE ANSWER, NOT THE FEATURE, which is the whole reason it exists
 * as its own method rather than reusing a get-feature-by-id call. A
 * chromosome-scale block's CIGAR runs to tens of megabytes; serializing one to
 * the main thread to walk it there would undo the reason the band's bulk path
 * ships typed arrays in the first place. The walk happens beside the data and
 * three numbers come back.
 */
export default class SyntenyResolveMatchingRegion extends RpcMethodTypeWithRenameRegions<'SyntenyResolveMatchingRegion'> {
  name = 'SyntenyResolveMatchingRegion' as const

  async execute(args: RpcExecuteArgs<'SyntenyResolveMatchingRegion'>) {
    const { window, toMate } = args
    const alignment = await findAlignmentById(this.pluginManager, args)
    if (!alignment) {
      return undefined
    }
    const { resolveAlignmentSpan } = await import('./resolveAlignmentSpan.ts')
    return resolveAlignmentSpan({ alignment, window, toMate })
  }
}
