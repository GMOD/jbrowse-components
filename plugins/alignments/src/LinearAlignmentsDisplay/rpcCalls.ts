import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import { SimpleFeature, getRpcSessionId, getSession } from '@jbrowse/core/util'

import type { RenderAlignmentDataArgs } from '../RenderAlignmentDataRPC/types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

// The right-click feature-details fetch, and the sequence adapter both of this
// display's RPCs hand the worker. Out of the model because it reads none of its
// state beyond what it is given — which is what lets it state its `self` as a
// duck type rather than as the whole display.

export function getSequenceAdapter(
  session: AbstractSessionModel,
  region: Region,
) {
  return getSequenceAdapterConfig(
    region.assemblyName
      ? session.assemblyManager.get(region.assemblyName)
      : undefined,
  )
}

export interface FetchFeatureDetailsSelf {
  adapterConfig: Record<string, unknown>
  rpcProps: () => { lodMode?: BaseOptions['lodMode'] }
  getFeatureInfoById: (id: string) =>
    | {
        refName: string
        assemblyName: string
        start: number
        end: number
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
  const sequenceAdapter = getSequenceAdapter(session, region)
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
      sequenceAdapter,
      regions: [region],
      featureId,
      // The tier the pileup was fetched at. A tiered PIF adapter numbers its
      // coarse and fine rows from different file offsets, so ids only match
      // within one tier — querying the default (fine) tier for a feature drawn
      // from the coarse one found nothing, and the details silently never came.
      // Read live rather than recorded with the data because the two can't
      // drift: `lodMode` is part of `rpcProps`, so a tier flip trips
      // SettingsInvalidate, which drops every fetched region. Data on screen was
      // always fetched at the tier `rpcProps` names right now.
      lodMode: self.rpcProps().lodMode,
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
  rpcProps: () => Omit<
    RenderAlignmentDataArgs,
    'adapterConfig' | 'sequenceAdapter' | 'regions'
  >
}

// One RPC for both pileup and chain modes; the worker branches on `linkedReads`
// (passed via rpcProps).
export function fetchFeaturesForRegion(
  self: FetchFeaturesSelf,
  adapterConfig: Record<string, unknown>,
  region: Region,
  ctx: FetchContext,
) {
  const session = getSession(self)
  return session.rpcManager.call(getRpcSessionId(self), 'RenderAlignmentData', {
    adapterConfig,
    sequenceAdapter: getSequenceAdapter(session, region),
    regions: [region],
    ...self.rpcProps(),
    stopToken: ctx.stopToken,
    // this region's slot on the fetch's fan-out, so the N parallel
    // collapsed-intron fetches aggregate into one bar instead of clobbering
    // each other's progress text
    statusCallback: ctx.statusCallback,
  })
}
