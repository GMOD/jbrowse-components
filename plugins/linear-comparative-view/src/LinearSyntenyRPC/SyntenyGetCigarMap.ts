import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { rpcResult, rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

import { findAlignmentById } from './findAlignmentById.ts'

import type { CigarMap } from './buildCigarMap.ts'
import type { AlignmentLookupArgs } from './findAlignmentById.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// Nothing beyond the lookup: this method answers about the BLOCK, so the window
// `SyntenyResolveMatchingRegion` also takes has no place here.
export type SyntenyGetCigarMapArgs = AlignmentLookupArgs

/**
 * A CIGAR map plus the block extents it is measured against, which is what lets
 * the caller reject a map built for a different block: the offsets mean nothing
 * without the coordinates they count from, and the two travel separately (the
 * caller has the coordinates from the bulk fetch).
 */
export interface SyntenyCigarMapResult extends CigarMap {
  start: number
  end: number
  mateStart: number
  mateEnd: number
  strand: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyGetCigarMap: {
      args: SyntenyGetCigarMapArgs
      return: SyntenyCigarMapResult | undefined
      // wrapped in rpcResult so postMessage transfers the offset arrays
      transferables: true
    }
  }
}

/**
 * One alignment's CIGAR reduced to a few thousand bend points, so the follow can
 * place a row between settles by reading the alignment instead of extrapolating
 * a straight line off the last answer.
 *
 * SIBLING OF `SyntenyResolveMatchingRegion`, NOT A REPLACEMENT FOR IT. That one
 * answers one window and is asked again for the next; this is asked once per
 * block and answers every window inside it. The resolve stays because it is what
 * navigates — a matching region on another contig is a `navTo`, which the frame
 * pass must not do — and because a block with no CIGAR has no map and still
 * needs an answer.
 *
 * NO REFNAMES COME BACK, deliberately. Every other synteny result carries names
 * out of the adapter's namespace and needs the return-direction rename that
 * `agent-docs/reference/REFNAME_NAMESPACES.md` describes; this one carries
 * numbers only, and the caller already holds both canonical refNames on the
 * `FeatPos` it picked. One less channel that can be canonicalized on one side.
 */
export default class SyntenyGetCigarMap extends RpcMethodTypeWithRenameRegions<'SyntenyGetCigarMap'> {
  name = 'SyntenyGetCigarMap' as const

  async execute(args: RpcExecuteArgs<'SyntenyGetCigarMap'>) {
    // `transferables: true` on the registry entry means every return is
    // wrapped, misses included — an unwrapped `undefined` is a type error here
    // rather than a runtime surprise, which is the point of declaring it. It is
    // also why `findAlignmentById` hands back the feature rather than a miss:
    // the wrapping is this method's, not the lookup's.
    const miss = rpcResult(undefined, [])
    const alignment = await findAlignmentById(this.pluginManager, args)
    if (!alignment) {
      return miss
    }
    const [{ buildCigarMap }, { getAlignmentOps, getMate }] = await Promise.all(
      [import('./buildCigarMap.ts'), import('../syntenyMate.ts')],
    )
    const mate = getMate(alignment)
    const cigar = getAlignmentOps(alignment)
    if (!mate || !cigar) {
      return miss
    }
    return rpcResultWithArrayBuffers({
      ...buildCigarMap(cigar),
      start: alignment.get('start'),
      end: alignment.get('end'),
      mateStart: mate.start,
      mateEnd: mate.end,
      strand: alignment.get('strand') ?? 1,
    })
  }
}
