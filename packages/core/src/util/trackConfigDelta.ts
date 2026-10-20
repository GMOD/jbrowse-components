/**
 * Track-config override deltas.
 *
 * A non-admin's track-menu / Settings edits are stored as a *delta* against the
 * admin-owned base config (jbrowse.tracks entry), not as a full copy. The delta
 * records only the slots the user changed; everything else resolves from the
 * live base, so a later admin change to an untouched field (e.g. a corrected
 * adapter URL) still flows through instead of being masked by a pinned full
 * snapshot.
 *
 * Two operations, inverse of each other on the realistic edit path:
 *   - `diffTrackConfig(base, edited)` — the minimal delta
 *   - `mergeTrackConfig(base, delta)` — reconstruct the effective config
 *
 * A delta is a JSON Merge Patch (RFC 7396) over the base, so a `null` member is
 * a reset: the merge removes the member and the schema's default applies. That
 * is ADR-146's spelling of a reset, and the diff writes one wherever the base
 * sets a member the edited config lacks — a slot put back to its default, or a
 * list emptied, since `stripDefault` drops both from a snapshot. Where the edit
 * left a whole namespace at its default, the nulls land on the members the base
 * set inside it rather than on the namespace, so a member the admin adds there
 * later still flows through. The inference
 * is exact only because both sides are post-`stripDefault` snapshots: a member
 * the admin wrote at its default is absent from both, where a `null` for it
 * would block a later admin value. As in RFC 7396, a delta cannot set a member
 * to a literal `null`; null and absent are one state.
 *
 * `displays` is merged by `displayId` so an edit to one display doesn't pin the
 * others, and by `type` where the base has no display of that id. Nested config
 * objects (e.g. `adapter`) recurse, except an object the display's schema
 * writes whole (`wholeAt`, a channel such as `color` or `rows`): its members
 * are alternatives, so a user's pick stores the whole object and replaces the
 * base's, and an admin's later member there no longer reaches that user. Any
 * other array (value arrays like `filter`, `assemblyNames`) is replaced
 * wholesale when changed.
 *
 * Subtlety worth not "optimizing": when the base has NO `displays` array but the
 * edited snapshot does (common — a track config that omits displays gets a stub
 * per compatible display type injected by `baseTrackConfig.preProcessSnapshot`
 * when it hydrates), the whole edited array lands in the delta, including
 * seemingly content-free `{type, displayId}` stubs. Do not strip those stubs to
 * shrink the delta: the array order defines the default display (`displays[0]`),
 * and re-injection on the next hydrate would append them in a different order,
 * silently changing which display opens by default.
 */

import { deepEqual } from './deepEqual.ts'

type Json =
  | string
  | number
  | boolean
  | null
  | undefined
  | Json[]
  | { [key: string]: Json }

type JsonObject = Record<string, Json>

function isPlainObject(v: Json): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// An array is display-shaped (merge by identity) when every element is an object
// carrying a displayId. Anything else is a value array (replace-on-change).
function isDisplayArray(v: Json): v is JsonObject[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(e => isPlainObject(e) && typeof e.displayId === 'string')
  )
}

/**
 * Whether a display of `displayType` writes the object at `path` inside it
 * whole, its schema declaring `writes: 'whole'`.
 */
export type WholeAt = (displayType: string, path: readonly string[]) => boolean

// Where a walk stands: inside a display of `type`, at `path` within it.
interface At {
  wholeAt?: WholeAt
  type?: string
  path: string[]
}

const childAt = (at: At, key: string): At => ({
  ...at,
  path: [...at.path, key],
})

const displayAt = (at: At, ...displays: (JsonObject | undefined)[]): At => ({
  ...at,
  type: displays.map(d => d?.type).find(t => typeof t === 'string'),
  path: [],
})

const isWhole = (at: At) =>
  at.type !== undefined && !!at.wholeAt?.(at.type, at.path)

const UNCHANGED = Symbol('unchanged')

function diffValue(base: Json, edited: Json, at: At): Json | typeof UNCHANGED {
  if (edited == null) {
    if (base == null) {
      return UNCHANGED
    }
    return isPlainObject(base) && !isWhole(at) ? diffValue(base, {}, at) : null
  }
  if (deepEqual(base, edited)) {
    return UNCHANGED
  }
  if (isDisplayArray(edited) && isDisplayArray(base)) {
    const baseById = new Map(base.map(d => [d.displayId as string, d]))
    const out: JsonObject[] = []
    for (const editedDisplay of edited) {
      const id = editedDisplay.displayId as string
      const baseDisplay = baseById.get(id)
      if (baseDisplay) {
        const d = diffValue(
          baseDisplay,
          editedDisplay,
          displayAt(at, editedDisplay, baseDisplay),
        )
        if (d !== UNCHANGED) {
          out.push({ ...(d as JsonObject), displayId: id })
        }
      } else {
        out.push(editedDisplay)
      }
    }
    return out.length > 0 ? out : UNCHANGED
  }
  if (isPlainObject(edited) && isPlainObject(base) && !isWhole(at)) {
    const out: JsonObject = {}
    for (const k of new Set([...Object.keys(base), ...Object.keys(edited)])) {
      const d = diffValue(base[k], edited[k], childAt(at, k))
      if (d !== UNCHANGED) {
        out[k] = d
      }
    }
    return Object.keys(out).length > 0 ? out : UNCHANGED
  }
  return edited
}

/**
 * Minimal delta of `edited` against `base`, both post-stripDefault snapshots. A
 * member `base` sets and `edited` lacks is a `null` (see the module note).
 * Always retains `trackId` so the delta is self-identifying.
 */
export function diffTrackConfig(
  base: Record<string, unknown>,
  edited: Record<string, unknown>,
  wholeAt?: WholeAt,
): Record<string, unknown> {
  const d = diffValue(base as JsonObject, edited as JsonObject, {
    wholeAt,
    path: [],
  })
  const delta = d === UNCHANGED ? {} : (d as JsonObject)
  const trackId = (edited.trackId ?? base.trackId) as Json
  return { ...delta, trackId }
}

// A delta display naming an id the base lacks lands on the base display of its
// type, keeping the base's id: a track holds one display per type, and a
// migrated session addresses the display by the id its old type minted.
function mergeValue(base: Json, delta: Json, at: At): Json {
  if (isDisplayArray(delta)) {
    const baseDisplays = isDisplayArray(base) ? base : []
    const baseIds = new Set(baseDisplays.map(d => d.displayId as string))
    const deltaByBaseId = new Map<string, JsonObject>()
    const added: JsonObject[] = []
    for (const d of delta) {
      const byType = baseIds.has(d.displayId as string)
        ? undefined
        : baseDisplays.find(b => d.type !== undefined && b.type === d.type)
      const id = (byType?.displayId ?? d.displayId) as string
      if (baseIds.has(id)) {
        const onId = { ...d, displayId: id }
        const earlier = deltaByBaseId.get(id)
        deltaByBaseId.set(
          id,
          earlier
            ? (mergeValue(
                earlier,
                onId,
                displayAt(
                  at,
                  onId,
                  baseDisplays.find(b => b.displayId === id),
                ),
              ) as JsonObject)
            : onId,
        )
      } else {
        added.push(d)
      }
    }
    const merged = baseDisplays.map(baseDisplay => {
      const d = deltaByBaseId.get(baseDisplay.displayId as string)
      return d
        ? (mergeValue(
            baseDisplay,
            d,
            displayAt(at, d, baseDisplay),
          ) as JsonObject)
        : baseDisplay
    })
    for (const d of added) {
      merged.push(mergeValue(undefined, d, displayAt(at, d)) as JsonObject)
    }
    return merged
  }
  if (isPlainObject(delta) && !isWhole(at)) {
    const out: JsonObject = isPlainObject(base) ? { ...base } : {}
    for (const [k, v] of Object.entries(delta)) {
      if (v === null) {
        delete out[k]
      } else {
        out[k] = mergeValue(out[k], v, childAt(at, k))
      }
    }
    return out
  }
  return isPlainObject(delta) ? withoutNulls(delta) : delta
}

// A whole object replaces the base's, so a `null` in it names nothing to
// reset; one written member by member before a schema declared the object
// whole drops it rather than handing the config a null.
function withoutNulls(o: JsonObject) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null))
}

/**
 * Reconstruct the effective config by layering `delta` over the live `base`.
 * A `null` removes the member it names, and one naming something the base no
 * longer has is dropped, so no `null` member reaches the config a track
 * hydrates from.
 */
export function mergeTrackConfig<BASE extends Record<string, unknown>>(
  base: BASE,
  delta: Record<string, unknown>,
  wholeAt?: WholeAt,
): BASE {
  return mergeValue(base as JsonObject, delta as JsonObject, {
    wholeAt,
    path: [],
  }) as BASE
}

/**
 * A single overridden slot: the dotted `path`, its base `from` and edited `to`,
 * which is `undefined` for a reset.
 */
export interface TrackConfigChange {
  /**
   * Where the setting lives. A producer that wants a friendlier heading sets
   * `label` and leaves this alone.
   */
  path: string[]
  from: Json
  to: Json
  /**
   * What to head the row with, when the path is an address rather than
   * something to read. `SettingsChangesTable` falls back to the joined path,
   * which is what every delta row still wants — a config path IS the readable
   * thing there.
   */
  label?: string
}

// Keys that identify a config node rather than record a user edit: trackId, kept
// by diffTrackConfig so the delta self-identifies, and displayId, which diffValue
// re-stamps on every display it emits. Neither reflects a setting the user
// changed, so listing changes skips them at any depth.
const IDENTITY_KEYS = new Set(['trackId', 'displayId'])

// `type` is identity only on a display-array element, where a display present in
// the delta for its `{type, displayId}` stub alone must emit nothing. Elsewhere
// it is a real edit: swapping `adapter.type` or a renderer type changes what the
// track shows, and skipping it by bare key name at every depth made such an edit
// invisible to `isTrackOverride` (no edited badge, no Reset) and to the desktop
// web export, whose ship gate is this same list — an adapter-type edit produced
// an empty change list and so travelled to the recipient not at all.
const DISPLAY_IDENTITY_KEYS = new Set([...IDENTITY_KEYS, 'type'])

function walkDelta(
  base: Json,
  delta: Json,
  path: string[],
  out: TrackConfigChange[],
  at: At,
  identityKeys: Set<string> = IDENTITY_KEYS,
): void {
  if (isDisplayArray(delta)) {
    const baseById = new Map(
      (isDisplayArray(base) ? base : []).map(d => [d.displayId as string, d]),
    )
    for (const editedDisplay of delta) {
      const id = editedDisplay.displayId as string
      const baseDisplay = baseById.get(id)
      const label = (editedDisplay.type ?? baseDisplay?.type ?? id) as string
      // recurse into every display (missing base ⇒ {}) so only real slot edits
      // surface — a display present only for its {type, displayId} stub yields
      // no changes rather than being dumped whole
      walkDelta(
        baseDisplay ?? {},
        editedDisplay,
        [...path, label],
        out,
        displayAt(at, editedDisplay, baseDisplay),
        DISPLAY_IDENTITY_KEYS,
      )
    }
  } else if (isPlainObject(delta) && isPlainObject(base) && isWhole(at)) {
    // the whole object replaces the base's, so a member it left out is reset
    for (const k of new Set([...Object.keys(base), ...Object.keys(delta)])) {
      if (!deepEqual(base[k], delta[k])) {
        out.push({ path: [...path, k], from: base[k], to: delta[k] })
      }
    }
  } else if (isPlainObject(delta) && isPlainObject(base)) {
    for (const [k, v] of Object.entries(delta)) {
      if (!identityKeys.has(k)) {
        walkDelta(base[k], v, [...path, k], out, childAt(at, k))
      }
    }
  } else {
    out.push({ path, from: base, to: delta ?? undefined })
  }
}

/**
 * Flatten a stored track-config `delta` (see {@link diffTrackConfig}) into a
 * list of changed slots paired with their `base` values, so the UI can show a
 * user exactly which settings they've overridden and what the default was.
 * Displays are addressed by type/displayId; identity keys are omitted.
 */
export function flattenTrackConfigDelta(
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
  wholeAt?: WholeAt,
): TrackConfigChange[] {
  const out: TrackConfigChange[] = []
  walkDelta(base as JsonObject, delta as JsonObject, [], out, {
    wholeAt,
    path: [],
  })
  return out
}
