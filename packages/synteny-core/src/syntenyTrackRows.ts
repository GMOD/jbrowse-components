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
