import { readConfObject } from '@jbrowse/core/configuration'

import { pickMatesForRegion } from './pickMatesForRegion.ts'

import type { MateCandidate } from './pickMatesForRegion.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export type MateDiscovery = (stopToken: StopToken) => Promise<MateCandidate[]>

// Which assemblies a region aligns to, and on which alignment each.
//
// The features are fetched straight from the track's adapter rather than read
// off a display: the launch is offered for any synteny track in the session, so
// there may be no display to read (and what a display holds is packed worker
// output keyed by feature index, while the panels need whole Features with
// their mate and CIGAR). The region is one rubberband selection, and an
// in-memory PAF is already parsed behind the adapter's shared setup.
//
// The caller's `stopToken` travels with the RPC: a selection can be a whole
// chromosome, and the download+parse behind it is exactly the phase that honors
// the token, so closing the dialog aborts the work rather than leaving a worker
// grinding on a view nobody is waiting for.
export function makeMateDiscovery({
  session,
  track,
  region,
}: {
  // passed rather than reached for with getSession: `track` is a track *config*,
  // and a config node is not under the session in the state tree (a connection's
  // configs are not even under the config root), so getSession throws there
  session: AbstractSessionModel
  track: AnyConfigurationModel
  region: Region
}): MateDiscovery {
  return async stopToken => {
    const { rpcManager } = session
    const trackId = readConfObject(track, 'trackId') as string
    const features: Feature[] = await rpcManager.call(
      trackId,
      'CoreGetFeatures',
      {
        adapterConfig: readConfObject(track, 'adapter') as Record<
          string,
          unknown
        >,
        regions: [region],
        stopToken,
      },
    )
    return pickMatesForRegion({
      features,
      region,
      trackAssemblyNames: readConfObject(track, 'assemblyNames') as string[],
      anchorAssembly: region.assemblyName,
    })
  }
}
