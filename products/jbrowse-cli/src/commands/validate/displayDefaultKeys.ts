import { isKeyedWrites } from '@jbrowse/add-track-core'

import { configManifest } from './configManifest.generated.ts'

import type {
  ConfigManifest,
  SlotEntry,
  TypeEntry,
  TypeGroup,
} from './types.ts'
import type { KeyedWrites } from '@jbrowse/add-track-core'

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

/**
 * The `misnamed` words of a track's displays, one map over them, as
 * `displayDefaults` routes a key to whichever display declares it.
 */
export function displayDefaultMisnamed(
  trackEntry: TypeEntry,
  manifest: ConfigManifest,
) {
  return Object.fromEntries(
    (trackEntry.displayTypes ?? []).flatMap(name =>
      Object.entries(manifest.displays[name]?.misnamed ?? {}),
    ),
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
    misnamed: entry ? displayDefaultMisnamed(entry, manifest) : {},
  }
}

// Every declaration's refinements, or undefined where two say a value refines
// different ones
function mergedRefines(keyed: KeyedWrites[]) {
  const pairs = keyed.flatMap(w => Object.entries(w.refines ?? {}))
  const refines = Object.fromEntries(pairs)
  return pairs.every(([from, to]) => refines[from] === to) ? refines : undefined
}

// Whole where any declaration writes it whole, two key it by different
// fields or two refine one value differently; keyed where any keys it, by
// every declaration's keyed members and refinements, as `rows` gains a member
// on some displays only, an empty value changing it where any declaration
// says so; members otherwise.
function mergedWrites(slots: SlotEntry[]) {
  const keyed = slots.map(s => s.writes).filter(isKeyedWrites)
  const keyedBy = new Set(keyed.map(w => w.keyedBy))
  const [field] = keyedBy
  const refines = mergedRefines(keyed)
  return slots.some(s => s.writes !== 'members' && !isKeyedWrites(s.writes)) ||
    keyedBy.size > 1 ||
    !refines
    ? 'whole'
    : field === undefined
      ? 'members'
      : {
          keyedBy: field,
          keyed: [...new Set(keyed.flatMap(w => w.keyed))],
          ...(keyed.some(w => w.emptyChanges) ? { emptyChanges: true } : {}),
          ...(Object.keys(refines).length > 0 ? { refines } : {}),
        }
}

// One slot per name across several displays' lists: a sub-schema everywhere
// it is declared merges its members' slots, writes them as `mergedWrites`
// folds the declarations, and lifts a bare value only into the target they
// share.
function mergedSlots(lists: SlotEntry[][]): SlotEntry[] {
  const byName = new Map<string, SlotEntry[]>()
  for (const slot of lists.flat()) {
    byName.set(slot.name, [...(byName.get(slot.name) ?? []), slot])
  }
  return [...byName.values()].map(slots => {
    const [first] = slots as [SlotEntry, ...SlotEntry[]]
    const plain = slots.find(s => !s.subSlots)
    if (plain) {
      return plain
    }
    const forms = ['string', 'number', 'list'] as const
    const shorthand = Object.fromEntries(
      forms.flatMap(form => {
        const targets = new Set(slots.map(s => s.shorthand?.[form]))
        const [target] = targets
        return targets.size === 1 && target !== undefined
          ? [[form, target]]
          : []
      }),
    )
    return {
      ...first,
      writes: mergedWrites(slots),
      shorthand,
      subSlots: mergedSlots(slots.map(s => s.subSlots!)),
    }
  })
}

/**
 * The slots a track type's `displayDefaults` writes, one per name across its
 * displays, for merging two bags as the app folds them (`mergeBySlots`).
 * Empty for a type the manifest does not carry.
 */
export function displayDefaultSlots(
  trackType: string,
  manifest: ConfigManifest = configManifest,
) {
  return mergedSlots(
    (lookup(manifest.tracks, trackType)?.displayTypes ?? []).map(
      name => manifest.displays[name]?.slots ?? [],
    ),
  )
}

function lookup(group: TypeGroup, typeName: string) {
  return (
    group[typeName] ??
    Object.values(group).find(entry => entry.aliases?.includes(typeName))
  )
}
