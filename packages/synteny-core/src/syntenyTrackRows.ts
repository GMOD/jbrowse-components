import { readConfObject } from '@jbrowse/core/configuration'

import { getSyntenyTracks } from './getSyntenyTracks.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * The assembly rows a synteny track implies, for the import forms' "Quick
 * start" mode. A pairwise track fills two rows; an all-vs-all track (more than
 * two assemblyNames) stacks every assembly it lists as a row, with the single
 * track backing every adjacent band. A self-alignment track names the same
 * assembly twice; that repeat is meaningful (it is what makes the pair
 * launchable) so it is kept rather than deduplicated.
 */
export function syntenyTrackRows(track: AnyConfigurationModel) {
  return [...(readConfObject(track, 'assemblyNames') as string[])]
}

/**
 * Which assembly of a synteny track's rows goes on each dotplot axis.
 *
 * **This is the only place that mapping is written down. Call it; don't
 * re-derive it.** Two independent derivations is how it drifts, and it has been
 * written backwards repeatedly — including in the docs, which claimed the query
 * goes on the x-axis until 2026-07-17.
 *
 * The chain: a track's `assemblyNames` are `[query, target]` (the
 * comparative-adapters convention — see `ImportSyntenyOpenCustomTrack`), and the
 * dotplot's public `assembly1`/`assembly2` props are `(y, x)` (see the dotplot
 * import form's `TrackSelector`). So query lands on **y** and target on **x**.
 *
 * There is no deeper truth to recover here: a synteny track answers in either
 * direction, so this is a defensible default rather than a fact about the track.
 * That is why the import form offers Swap — pass already-reversed rows for the
 * swapped orientation.
 */
export function dotplotAxesFromRows(rows: string[]) {
  return { y: rows[0], x: rows[1] }
}

/**
 * Session synteny tracks that Quick start can launch on their own: every track
 * naming at least two assemblies. A track naming fewer is misconfigured and
 * would imply a single-row view, which a synteny/dotplot view cannot open — it
 * is filtered here so Quick start's list only holds one-click-launchable
 * entries, rather than surfacing an option that errors on Launch.
 */
export function quickStartSyntenyTracks(tracks: AnyConfigurationModel[]) {
  return getSyntenyTracks(tracks, []).filter(
    track => syntenyTrackRows(track).length >= 2,
  )
}
