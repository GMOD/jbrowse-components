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
// the type it is writing, not a manifest entry. Empty for a type the manifest
// does not carry (a plugin's), which no check here can speak to.
export function displayDefaultKeysForTrackType(
  trackType: string,
  manifest: ConfigManifest = configManifest,
) {
  const entry = lookup(manifest.tracks, trackType)
  return entry ? displayDefaultKeys(entry, manifest) : []
}

function lookup(group: TypeGroup, typeName: string) {
  return (
    group[typeName] ??
    Object.values(group).find(entry => entry.aliases?.includes(typeName))
  )
}
