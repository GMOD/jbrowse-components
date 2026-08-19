import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { rpcResult, rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

import type { CigarMap } from './buildCigarMap.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

export interface SyntenyGetCigarMapArgs {
  adapterConfig: Record<string, unknown>
  // The block's own extent on the QUERY axis, the axis the band's fetch queries
  // — the same lookup `SyntenyResolveMatchingRegion` does, for the same reason.
  regions: Region[]
  featureId: string
  // Ids are only comparable within one tier, so the lookup has to name the tier
  // the picked feature came from.
  lodMode?: BaseOptions['lodMode']
}

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
    const {
      sessionId,
      adapterConfig,
      regions,
      featureId,
      lodMode,
      stopToken,
      statusCallback,
    } = args
    // `transferables: true` on the registry entry means every return is
    // wrapped, misses included — an unwrapped `undefined` is a type error here
    // rather than a runtime surprise, which is the point of declaring it.
    const miss = rpcResult(undefined, [])
    const region = regions[0]
    if (!region) {
      return miss
    }
    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    const features =
      (await dataAdapter?.getFeaturesArray(region, {
        lodMode,
        stopToken,
        statusCallback,
      })) ?? []
    const alignment = features.find(f => f.id() === featureId)
    if (!alignment) {
      return miss
    }
    const [{ buildCigarMap }, { getCigar, getMate }] = await Promise.all([
      import('./buildCigarMap.ts'),
      import('../syntenyMate.ts'),
    ])
    const mate = getMate(alignment)
    const cigar = getCigar(alignment)
    if (!mate || !cigar) {
      return miss
    }
    const { parseCigar2Typed } = await import('@jbrowse/cigar-utils')
    return rpcResultWithArrayBuffers({
      ...buildCigarMap(parseCigar2Typed(cigar)),
      start: alignment.get('start'),
      end: alignment.get('end'),
      mateStart: mate.start,
      mateEnd: mate.end,
      strand: alignment.get('strand') ?? 1,
    })
  }
}
