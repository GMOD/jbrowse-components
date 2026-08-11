import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { ResolvedSpan, SpanOfInterest } from './resolveAlignmentSpan.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

export interface SyntenyResolveMatchingRegionArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  // The clicked block's own extent on the QUERY axis, which is the axis the
  // band's fetch queries (`executeSyntenyFeaturesAndPositions` is single-axis:
  // "The fetch is single-axis (query only)"). Both directions of the resolve
  // therefore look the feature up the same way — only the walk differs.
  regions: Region[]
  featureId: string
  // The visible window of the panel that is STAYING, in that panel's own
  // genomic coordinates.
  window: SpanOfInterest
  // true when the panel being moved is on the mate axis, false when it is on
  // the feature axis
  toMate: boolean
  // The tier the band was fetched at. Feature ids are only comparable within
  // one tier -- a tiered PIF numbers its coarse and fine rows from different
  // file offsets -- so the lookup has to ask for the same one. It is also the
  // tier whose CIGARs decide whether there is an answer at all: the coarse tier
  // carries none, which is why the menu items are hidden there rather than
  // relying on this returning undefined.
  lodMode?: BaseOptions['lodMode']
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
export default class SyntenyResolveMatchingRegion extends RpcMethodTypeWithRenameRegions {
  name = 'SyntenyResolveMatchingRegion'

  async execute(
    args: SyntenyResolveMatchingRegionArgs,
    rpcDriverClassName: string,
  ) {
    const {
      sessionId,
      adapterConfig,
      regions,
      featureId,
      window,
      toMate,
      lodMode,
    } = await this.deserializeArguments(args, rpcDriverClassName)

    const region = regions[0]
    if (!region) {
      return undefined
    }
    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    const features =
      (await dataAdapter?.getFeaturesArray(region, { lodMode })) ?? []
    const alignment = features.find(f => f.id() === featureId)
    if (!alignment) {
      return undefined
    }
    const { resolveAlignmentSpan } = await import('./resolveAlignmentSpan.ts')
    return resolveAlignmentSpan({ alignment, window, toMate })
  }
}
