import { SimpleFeature, getRpcSessionId, getSession } from '@jbrowse/core/util'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'

import type { RenderAlignmentDataArgs } from '../RenderAlignmentDataRPC/types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { GatedFetchArgs } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/display-kit/FetchMixin'

// The right-click feature-details fetch, and the sequence adapter both of this
// display's RPCs hand the worker. Out of the model because it reads none of its
// state beyond what it is given — which is what lets it state its `self` as a
// duck type rather than as the whole display.

export interface FetchFeatureDetailsSelf {
  adapterConfig: Record<string, unknown>
  getFeatureInfoById: (id: string) =>
    | {
        refName: string
        assemblyName: string
        start: number
        end: number
        lodMode: BaseOptions['lodMode']
      }
    | undefined
}

export async function fetchFeatureDetails(
  self: FetchFeatureDetailsSelf,
  featureId: string,
) {
  const session = getSession(self)
  const info = self.getFeatureInfoById(featureId)
  if (!info) {
    return undefined
  }
  // refName + assemblyName come from the loaded region the read was fetched
  // from (see getFeatureInfoById), so there's nothing to look up here. The old
  // refName scan over loadedRegions could pick a different region's assembly and
  // threw on the one it couldn't resolve.
  //
  // A single base at the feature's start, not its full extent: the adapter
  // returns everything overlapping the region and we keep the one matching id,
  // so the extent only ever made the query bigger. It is the read's own length
  // for a BAM, but the whole block for a synteny alignment — right-clicking a
  // megabase PAF block re-read the entire block just to name it, so the menu's
  // feature items landed seconds after it opened.
  const region = {
    refName: info.refName,
    assemblyName: info.assemblyName,
    start: info.start,
    end: info.start + 1,
  }
  const sessionId = getRpcSessionId(self)
  const { feature } = await session.rpcManager.call(
    sessionId,
    'GetPileupFeatureDetails',
    // Nothing to report and nothing worth stopping: the region is a single base
    // (see above), the adapter's index is already resident by the time a read is
    // on screen to right-click, and the widget this feeds opens on the result.
    // eslint-disable-next-line no-restricted-syntax
    {
      adapterConfig: self.adapterConfig,
      regions: [region],
      featureId,
      // The tier the region was fetched at, recorded with its data. A tiered
      // PIF adapter numbers its coarse and fine rows from different file
      // offsets, so ids only match within one tier — querying the default
      // (fine) tier for a feature drawn from the coarse one found nothing, and
      // the details silently never came. Recorded rather than read live because
      // a tier flip is a `zoomFetchKey` move: the held regions keep drawing
      // until the refetch lands, at the tier they were fetched at.
      lodMode: info.lodMode,
    },
  )
  if (!feature) {
    return undefined
  }
  return new SimpleFeature(feature)
}

// The props bag the display assembles, stated as what is left of the RPC's args
// once this function supplies the rest. Naming the RPC's own type rather than
// `Record<string, unknown>` is what keeps a wrong-typed field in `rpcProps()` an
// error here.
//
// It does NOT catch a field `rpcProps` names and the worker never reads: TS
// applies excess-property checking to fresh object literals, and a spread of an
// existing object's properties is not fresh — so the args literal this moved out
// of never caught one either. `fetchAutorun.test.ts` is what pins membership,
// and it does it by refetch behaviour rather than by shape.
export interface FetchFeaturesSelf {
  adapterConfig: Record<string, unknown>
  rpcProps: () => Omit<
    RenderAlignmentDataArgs,
    'adapterConfig' | 'sequenceAdapter' | 'regions' | keyof GatedFetchArgs
  >
  resolvedByteLimit: () => number | undefined
  // The per-base sampling stride, at the call site rather than in `rpcProps()`
  // because it swings with zoom and would otherwise be an RPC cache key. What
  // keeps it from being a cache key that never invalidates is that the display
  // also spells it as its `zoomFetchKey`, so a region fetched under one bin is
  // not read back under another.
  perBaseBinBp: number
  // The detail tier, at the call site for the same reason — undefined where the
  // adapter has one tier to serve.
  lodTier: BaseOptions['lodMode']
}

// One RPC for both pileup and chain modes; the worker branches on `linkedReads`
// (passed via rpcProps).
export function fetchFeaturesForRegion(
  self: FetchFeaturesSelf,
  region: Region,
  ctx: FetchContext,
) {
  return ctx.callRpc('RenderAlignmentData', {
    ...rpcArgs(self),
    regions: [region],
    perBaseBinBp: self.perBaseBinBp,
    lodMode: self.lodTier,
  })
}
