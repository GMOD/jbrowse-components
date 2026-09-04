import { readConfObject } from '@jbrowse/core/configuration'
import { regionsInAssemblyNamespace } from '@jbrowse/synteny-core'

import type { MateDiscoveryResult } from './pickMatesForRegion.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  AssemblyHost,
  RpcHost,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export type MateDiscovery = (
  stopToken: StopToken,
  statusCallback: StatusCallback,
) => Promise<MateDiscoveryResult>

// Which assemblies a region aligns to, and on which alignment each.
//
// Fetched straight from the track's adapter rather than read off a display: the
// launch is offered for any synteny track in the session, so there may be no
// display to read (and what a display holds is packed worker output keyed by
// feature index, while the panels need whole Features with their mate and
// CIGAR).
//
// The reduction to one alignment per mate assembly happens in the worker, beside
// the fetch — see executeDiscoverMates for why that side of the boundary.
//
// Both of the caller's handles travel with the RPC, and both for the same
// reason: a selection can be a whole chromosome, so the download+parse behind
// this is long enough to want stopping and long enough to want narrating. The
// token is what makes closing the dialog abort the work rather than leave a
// worker grinding on a view nobody is waiting for; the callback is what turns
// the dialog's hardcoded "Finding assemblies that align to this region" into
// the phase actually running, with a bar where the adapter reports bytes.
//
// Declared on `MateDiscovery` rather than left for the RPC call to reach for,
// because the interface is what drops these — see PROGRESS_REPORTING.md, "A
// fetcher that declares no parameters is opted out, silently".
export function makeMateDiscovery({
  session,
  track,
  region,
}: {
  // passed rather than reached for with getSession: `track` is a track *config*,
  // and a config node is not under the session in the state tree (a connection's
  // configs are not even under the config root), so getSession throws there
  session: AssemblyHost & RpcHost
  track: AnyConfigurationModel
  region: Region
}): MateDiscovery {
  return async (stopToken, statusCallback) => {
    const { rpcManager } = session
    const trackId = readConfObject(track, 'trackId') as string
    const trackAssemblyNames = readConfObject(
      track,
      'assemblyNames',
    ) as string[]
    // Spelled as the TRACK spells it, because that is the namespace the far
    // side runs in: the worker has no assembly manager, the adapter answers
    // only a region whose assembly it recognizes, and a mate's `assemblyName`
    // is whatever it resolved out of its own `assemblyNames`. The view supplies
    // an alias of the same assembly often enough — `getSyntenyTracks` resolves
    // aliases to decide this track is launchable at all.
    const [anchor] = regionsInAssemblyNamespace(
      [region],
      trackAssemblyNames,
      session.assemblyManager,
    )
    return rpcManager.call(trackId, 'SyntenyDiscoverMates', {
      adapterConfig: readConfObject(track, 'adapter') as Record<
        string,
        unknown
      >,
      regions: [anchor!],
      trackAssemblyNames,
      anchorAssembly: anchor!.assemblyName,
      stopToken,
      statusCallback,
    })
  }
}
