import { configManifest } from './configManifest.generated.ts'

import type { ConfigManifest, TypeEntry, TypeGroup } from './types.ts'

// `displayDefaults: {color: 'green'}` is a track-level shorthand
// (expandTrackConfigShorthand.ts) routing each key to whichever of the track's
// display types declares it, so the keys a track accepts are the union of those
// displays' slots rather than the track's own.
export function displayDefaultKeys(
  trackEntry: TypeEntry,
  manifest: ConfigManifest,
) {
  return (trackEntry.displayTypes ?? []).flatMap(
    name => manifest.displays[name]?.slots.map(slot => slot.name) ?? [],
  )
}

// The same set for a track type named rather than resolved — add-track knows
// the type it is writing, not a manifest entry. The display types come back
// alongside, because most tracks offer exactly one and naming it is the whole
// difference between a message someone can act on and one they cannot: an
// AlignmentsTrack has only LinearAlignmentsDisplay, so "no AlignmentsTrack
// display declares color" sends the reader looking for the other displays.
//
// Both empty for a type the manifest does not carry (a plugin's), which no
// check here can speak to.
export function displayDefaultsForTrackType(
  trackType: string,
  manifest: ConfigManifest = configManifest,
) {
  const entry = lookup(manifest.tracks, trackType)
  return {
    displayTypes: entry?.displayTypes ?? [],
    keys: entry ? displayDefaultKeys(entry, manifest) : [],
  }
}

function lookup(group: TypeGroup, typeName: string) {
  return (
    group[typeName] ??
    Object.values(group).find(entry => entry.aliases?.includes(typeName))
  )
}
