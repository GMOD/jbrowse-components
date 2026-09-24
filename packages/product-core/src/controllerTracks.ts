import { getEnv } from '@jbrowse/core/util'
import { withPageBaseUri } from '@jbrowse/core/util/addRelativeUris'
import { guessTrackConf } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { resolveLocalFileUris } from './localFiles.ts'

import type { BlobLocation } from '@jbrowse/core/util'
import type { LooseTrackInput } from '@jbrowse/core/util/tracks'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The track half of an imperative controller: turning what a non-JSX host hands
// over into configs, and opening exactly those. Shared rather than written per
// product because every line below is a fix for something that failed silently
// — an unstamped assemblyNames, a shadowing duplicate in sessionTracks, a live
// splice during iteration — and a second copy is where the next fix would miss.

export type TrackConf = Record<string, unknown>

/**
 * What a controller accepts per track: a full config, the trackId of one the
 * catalog already holds (a hub's, when the assembly came from one), a bare
 * data-file URL, or `{ uri, index?, ...extra }`. The loose forms expand through
 * core's `guessTrackConf`, the same inference the "Add track" flow runs.
 */
export type TrackInput = string | TrackConf

// Duck-typed for the reason observeSession's shapes are: product-core cannot
// name a concrete product's session type without a root<->session cycle, and
// `session.view` is a pluggable MST type, i.e. `any` — so a real shape here is
// what keeps these reads checked at all.
interface ControllerView {
  tracks: { configuration: { trackId: string } }[]
  launchTrack: (trackId: string) => Promise<unknown>
  hideTrack: (trackId: string) => unknown
}

export interface ControllerSession extends IStateTreeNode {
  view: ControllerView
  getTrackById: (trackId: string) => unknown
  addSessionTrackConf: (conf: TrackConf) => unknown
}

export function isLooseTrack(
  track: TrackInput,
): track is string | LooseTrackInput {
  return typeof track === 'string' || (!('adapter' in track) && 'uri' in track)
}

/**
 * Stamp the view's assembly onto a full-config track that omits
 * `assemblyNames`. A single-view embed has exactly one assembly, so it is
 * unambiguous — and doing it here frees every host (R htmlwidgets, anywidget,
 * vanilla JS) from computing the name itself, which it often cannot: the
 * assembly may have arrived as a hub name only the view resolved. Loose tracks
 * take the same name through `guessTrackConf`'s `assemblyName` argument.
 */
export function withAssemblyName(track: TrackConf, assemblyName?: string) {
  return assemblyName !== undefined && !('assemblyNames' in track)
    ? { ...track, assemblyNames: [assemblyName] }
    : track
}

/**
 * Expand every loose entry into a full track config; stamp the assembly name
 * onto the ones already written out. A string the catalog already resolves is
 * that track, and is tried before the file guess: "not URL-shaped" cannot tell
 * an id from a relative path like `data/reads.bam`.
 */
export function resolveTracks(
  tracks: TrackInput[],
  session: ControllerSession,
  assemblyName?: string,
  localFiles?: Record<string, BlobLocation>,
): TrackConf[] {
  const { pluginManager } = getEnv(session)
  return tracks.map(track => {
    if (typeof track === 'string' && session.getTrackById(track)) {
      return { trackId: track }
    }
    const conf = isLooseTrack(track)
      ? guessTrackConf(track, pluginManager, assemblyName)
      : // full configs are stamped here too, not just in the build() catalog
        // seed: a config that first appears through addTrack never passes
        // through that seed, and would otherwise reach addSessionTrackConf with no
        // assemblyNames and silently fail to display
        withAssemblyName(track, assemblyName)
    // after the guess, so the adapter has already derived its index sibling
    // from the uri string and both get swapped for blobs together
    return withPageBaseUri(
      localFiles ? resolveLocalFileUris(conf, localFiles) : conf,
    )
  })
}

/**
 * Register each track config only if the session cannot already resolve it, then
 * show it. `getTrackById` resolves catalog + connection + session tracks, so a
 * config already seeded into the catalog is left alone rather than shadowed by a
 * duplicate in `sessionTracks` — which is also what `addSessionTrackConf`
 * dedupes on, so this states the intent rather than supplying it.
 *
 * Session-scoped: these are the host's declared tracks for one embed, not a
 * catalog an admin curates.
 */
export async function openTracks(
  session: ControllerSession,
  tracks: TrackConf[],
) {
  // sequential, not Promise.all: each display's state model may be a separate
  // dynamic import, and racing them would land the tracks on the view in
  // whatever order the chunks happen to resolve rather than the caller's
  for (const conf of tracks) {
    // the engine can be destroyed while a chunk is in flight (an unmounted
    // embed); reading the dead tree from this floating promise would throw
    // uncatchably
    if (!isAlive(session.view)) {
      return
    }
    const trackId = conf.trackId as string
    if (!session.getTrackById(trackId)) {
      session.addSessionTrackConf(conf)
    }
    await session.view.launchTrack(trackId)
  }
}

/** Open every wanted track and close any others the view currently shows. */
export async function reconcileTracks(
  session: ControllerSession,
  tracks: TrackConf[],
) {
  const { view } = session
  const wanted = new Set(tracks.map(t => t.trackId))
  await openTracks(session, tracks)
  if (!isAlive(view)) {
    return
  }
  // materialize the ids first: hideTrack splices view.tracks, so iterating it
  // live would skip entries
  const unwanted = view.tracks
    .map(track => track.configuration.trackId)
    .filter(trackId => !wanted.has(trackId))
  for (const trackId of unwanted) {
    view.hideTrack(trackId)
  }
}

/**
 * A hub's entries followed by the host's own, the host's winning where both
 * carry the same id: the `idKey` member, or what an `idKey` function returns.
 */
export function withHostOverrides<T extends object>(
  hub: readonly T[] = [],
  host: readonly T[] = [],
  idKey: string | ((entry: T) => unknown),
): T[] {
  const idOf = (entry: T) =>
    typeof idKey === 'function'
      ? idKey(entry)
      : (entry as Record<string, unknown>)[idKey]
  const hostIds = new Set<unknown>(
    host.map(idOf).filter(id => id !== undefined),
  )
  return [...hub.filter(entry => !hostIds.has(idOf(entry))), ...host]
}

/**
 * A search index is the trix file it reads, so a host's entry naming the same
 * file replaces the hub's. An index with no trix file is only ever itself.
 */
export function searchIndexKey(entry: object) {
  const { uri, ixFilePath } = entry as {
    uri?: string
    ixFilePath?: { uri?: string; localPath?: string }
  }
  return ixFilePath?.uri ?? ixFilePath?.localPath ?? uri ?? entry
}
