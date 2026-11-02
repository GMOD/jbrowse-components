import { configManifest } from './configManifest.generated.ts'
import { displayDefaultMisnamed } from './displayDefaultKeys.ts'

import type { ConfigManifest, SlotEntry } from './types.ts'

type Misnamed = Readonly<Record<string, string>>

function subSchemaMisnamed(slots: SlotEntry[]): [string, Misnamed][] {
  return slots.flatMap(slot => [
    ...(slot.schema && slot.misnamed
      ? [[slot.schema, slot.misnamed] satisfies [string, Misnamed]]
      : []),
    ...subSchemaMisnamed(slot.subSlots ?? []),
  ])
}

/**
 * Each schema's `misnamed` words by the title the config JSON Schema gives
 * the object they are written on: a type's own entry, a display's fields
 * folded onto a track entry, a track's `displayDefaults`, and a sub-schema
 * by its name.
 */
export function misnamedByTitle(manifest: ConfigManifest = configManifest) {
  const typed = [
    manifest.adapters,
    manifest.tracks,
    manifest.displays,
    manifest.textSearchAdapters,
    manifest.connections,
    manifest.internetAccounts,
  ].flatMap(group => Object.entries(group))
  return new Map<string, Misnamed>([
    ...typed.flatMap(([, entry]) => subSchemaMisnamed(entry.slots)),
    ...typed.flatMap(([name, entry]) =>
      entry.misnamed
        ? [[name, entry.misnamed] satisfies [string, Misnamed]]
        : [],
    ),
    ...Object.entries(manifest.displays).flatMap(([name, entry]) =>
      entry.misnamed
        ? [[`${name}TrackEntry`, entry.misnamed] satisfies [string, Misnamed]]
        : [],
    ),
    ...Object.entries(manifest.tracks).map(
      ([name, entry]) =>
        [
          `${name}DisplayDefaults`,
          displayDefaultMisnamed(entry, manifest),
        ] satisfies [string, Misnamed],
    ),
  ])
}
