import { getSnapshot } from '@jbrowse/mobx-state-tree'

import SessionLoader from './SessionLoader.ts'
import { deleteQueryParams, readQueryParams } from './useQueryParam.ts'

import type { SessionLoaderModel } from './SessionLoader.ts'
import type { Snap } from './types.ts'

// URL params consumed by the loader and stripped from the address bar.
// config, session and adminKey are intentionally preserved.
const paramsToDelete = [
  'loc',
  'tracks',
  'assembly',
  'password',
  'sessionTracks',
  'hubURL',
  'tracklist',
  'nav',
  'highlight',
  'sessionName',
] as const

// Pure read of the session-relevant URL params. No side effects, so it is
// safe under React StrictMode's double-invoked useState initializer (a second
// call must observe the same params as the first). Stripping the consumed
// params from the address bar is a separate one-time side effect performed by
// stripConsumedSessionParams once the loader is committed/mounted.
export function createSessionLoaderFromUrl(initialTimestamp: number) {
  const p = readQueryParams([
    'config',
    'session',
    'adminKey',
    'password',
    'loc',
    'assembly',
    'tracks',
    'sessionTracks',
    'tracklist',
    'highlight',
    'nav',
    'hubURL',
    'sessionName',
  ])
  return SessionLoader.create({
    configPath: p.config,
    sessionQuery: p.session,
    password: p.password,
    adminKey: p.adminKey,
    loc: p.loc,
    assembly: p.assembly,
    tracks: p.tracks,
    sessionTracks: p.sessionTracks,
    tracklist: p.tracklist === 'true',
    highlight: p.highlight,
    nav: p.nav !== 'false',
    hubURL: p.hubURL?.split(',').filter(Boolean),
    sessionName: p.sessionName,
    initialTimestamp,
  })
}

// Removes the one-time URL params (password, loc, tracks, ...) from the address
// bar. Kept separate from createSessionLoaderFromUrl so the read stays pure;
// called from the loader lifecycle effect, which only fires for the committed
// instance and is naturally idempotent (deleting absent params is a no-op).
export function stripConsumedSessionParams() {
  deleteQueryParams(paramsToDelete)
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
