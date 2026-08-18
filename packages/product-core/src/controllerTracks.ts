import { getEnv } from '@jbrowse/core/util'
import { guessTrackConf } from '@jbrowse/core/util/tracks'

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
 * What a controller accepts per track: a full config, a bare data-file URL, or
 * `{ uri, index?, ...extra }`. The loose forms expand through core's
 * `guessTrackConf`, the same inference the "Add track" flow runs.
 */
export type TrackInput = string | TrackConf

// Duck-typed for the reason observeSession's shapes are: product-core cannot
// name a concrete product's session type without a root<->session cycle, and
// `session.view` is a pluggable MST type, i.e. `any` — so a real shape here is
// what keeps these reads checked at all.
interface ControllerView {
  tracks: { configuration: { trackId: string } }[]
  showTrack: (trackId: string) => unknown
  hideTrack: (trackId: string) => unknown
}

export interface ControllerSession extends IStateTreeNode {
  view: ControllerView
  getTrackById: (trackId: string) => unknown
  addTrackConf: (conf: TrackConf) => unknown
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
 * onto the ones already written out. `node` is any node of the live tree — the
 * pluginManager whose format plugins drive the guess comes off its env.
 */
export function resolveTracks(
  tracks: TrackInput[],
  node: IStateTreeNode,
  assemblyName?: string,
  localFiles?: Record<string, BlobLocation>,
): TrackConf[] {
  const { pluginManager } = getEnv(node)
  return tracks.map(track => {
    const conf = isLooseTrack(track)
      ? guessTrackConf(track, pluginManager, assemblyName)
      : // full configs are stamped here too, not just in the build() catalog
        // seed: a config that first appears through addTrack never passes
        // through that seed, and would otherwise reach addTrackConf with no
        // assemblyNames and silently fail to display
        withAssemblyName(track, assemblyName)
    // after the guess, so the adapter has already derived its index sibling
    // from the uri string and both get swapped for blobs together
    return localFiles ? resolveLocalFileUris(conf, localFiles) : conf
  })
}

/**
 * Register each track config only if the session cannot already resolve it, then
 * show it. The guard matters: `addTrackConf` only dedupes against
 * `sessionTracks`, so re-adding a config already seeded into the config catalog
 * would push a duplicate into `sessionTracks` that then shadows the catalog
 * entry. `getTrackById` resolves catalog + connection + session tracks, so this
 * is idempotent.
 */
export function openTracks(session: ControllerSession, tracks: TrackConf[]) {
  for (const conf of tracks) {
    const trackId = conf.trackId as string
    if (!session.getTrackById(trackId)) {
      session.addTrackConf(conf)
    }
    session.view.showTrack(trackId)
  }
}

/** Open every wanted track and close any others the view currently shows. */
export function reconcileTracks(
  session: ControllerSession,
  tracks: TrackConf[],
) {
  const { view } = session
  const wanted = new Set(tracks.map(t => t.trackId))
  openTracks(session, tracks)
  // materialize the ids first: hideTrack splices view.tracks, so iterating it
  // live would skip entries
  const unwanted = view.tracks
    .map(track => track.configuration.trackId)
    .filter(trackId => !wanted.has(trackId))
  for (const trackId of unwanted) {
    view.hideTrack(trackId)
  }
}

/** Merge a hub's own search adapters with the ones the caller supplied. */
export function mergeSearchAdapters<T>(
  a: readonly T[] | undefined,
  b: readonly T[] | undefined,
) {
  const merged = [...(a ?? []), ...(b ?? [])]
  return merged.length ? merged : undefined
}
