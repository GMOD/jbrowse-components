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
  deleteQueryParams(paramsToDelete)
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
    hubURL: p.hubURL?.split(','),
    sessionName: p.sessionName,
    initialTimestamp,
  })
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
    sessionSnapshot,
  })
}
