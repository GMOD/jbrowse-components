import {
  readHubUrlParam,
  readNavParam,
  readTracklistParam,
  deleteQueryParams,
  readQueryParams,
} from '@jbrowse/app-core'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import SessionLoader from './SessionLoader.ts'

import type { SessionLoaderModel } from './SessionLoader.ts'
import type { Snap } from './types.ts'

// URL params the loader reads but leaves in the address bar, so a reload
// resolves the same config/session/admin mode.
const preservedParams = ['config', 'session', 'adminKey'] as const

// URL params the loader consumes once and then strips from the address bar.
// Kept as its own list, with the read below derived from both, so a new param
// can't be added to the read and silently left behind in the URL.
const consumedParams = [
  'loc',
  'tracks',
  'assembly',
  'password',
  'sessionTracks',
  'hubURL',
  'tracklist',
  'nav',
  'highlight',
  'regions',
  'sessionName',
  'extendSession',
] as const

// Pure read of the session-relevant URL params. No side effects, so it is
// safe under React StrictMode's double-invoked useState initializer (a second
// call must observe the same params as the first). Stripping the consumed
// params from the address bar is a separate one-time side effect performed by
// stripConsumedSessionParams once the loader is committed/mounted.
export function createSessionLoaderFromUrl(initialTimestamp: number) {
  const p = readQueryParams([...preservedParams, ...consumedParams])
  return SessionLoader.create({
    configPath: p.config,
    sessionQuery: p.session,
    password: p.password,
    adminKey: p.adminKey,
    loc: p.loc,
    assembly: p.assembly,
    tracks: p.tracks,
    regions: p.regions,
    sessionTracks: p.sessionTracks,
    // shared with parseSessionSpecUrl, which reads the same two params off a
    // link Desktop was handed. Their defaults are opposite ways round and
    // absent stays absent in both — see the readers for why — which is more
    // than enough to get wrong twice.
    tracklist: readTracklistParam(p.tracklist),
    nav: readNavParam(p.nav),
    highlight: p.highlight,
    extendSession: p.extendSession === 'true',
    hubURL: readHubUrlParam(p.hubURL),
    sessionName: p.sessionName,
    initialTimestamp,
  })
}

// Removes the one-time URL params (password, loc, tracks, ...) from the address
// bar. Kept separate from createSessionLoaderFromUrl so the read stays pure;
// called from the loader lifecycle effect, which only fires for the committed
// instance and is naturally idempotent (deleting absent params is a no-op).
export function stripConsumedSessionParams() {
  deleteQueryParams(consumedParams)
}

export function reloadSessionLoader(
  prev: SessionLoaderModel,
  configSnapshot: Snap,
  sessionSnapshot: Snap,
) {
  return SessionLoader.create({
    ...getSnapshot(prev),
    initialTimestamp: Date.now(),
    configSnapshot,
    sessionSource: { type: 'snapshot', snapshot: sessionSnapshot },
  })
}
